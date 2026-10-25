import Foundation
import Metal

struct Sample: Decodable {
    var id: String
    var source: [UInt8]
    var lookup: [UInt8]
    var tint: [Float]
    var normal: [Float]
    var fresnel: [Float]
    var remap: [UInt8]?
    var normals: [Float]?
    var scale: [Float]?
    var uv: [Float]?
    var transform: [Float]?
    var width: Int?
    var alphaRef: Float?
    var depthPushPull: Float?
}
func error(_ message: String) -> NSError { NSError(domain: "OwnedMetalRimHarness", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
func run() throws {
    guard CommandLine.arguments.count == 5 else { throw error("usage: render VS1 PS9 PS24 cases.json") }
    guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else { throw error("Metal device/queue unavailable") }
    func load(_ path: String) throws -> MTLLibrary {
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        return try data.withUnsafeBytes { try device.makeLibrary(data: DispatchData(bytes: $0)) }
    }
    let vs = try load(CommandLine.arguments[1]), ps9 = try load(CommandLine.arguments[2]), ps24 = try load(CommandLine.arguments[3])
    let vd = MTLVertexDescriptor()
    for (index, format, offset) in [(0, MTLVertexFormat.float3, 0), (2, .float3, 12), (8, .float2, 24)] {
        vd.attributes[index].format = format; vd.attributes[index].offset = offset; vd.attributes[index].bufferIndex = 0
    }
    vd.layouts[0].stride = 32
    func pipeline(_ fragment: MTLLibrary) throws -> MTLRenderPipelineState {
        let pd = MTLRenderPipelineDescriptor()
        pd.vertexFunction = vs.makeFunction(name: "wrapped_main"); pd.fragmentFunction = fragment.makeFunction(name: "wrapped_main")
        pd.vertexDescriptor = vd; pd.colorAttachments[0].pixelFormat = .rgba8Unorm
        return try device.makeRenderPipelineState(descriptor: pd)
    }
    let pipelines = [try pipeline(ps9), try pipeline(ps24)]
    let sd = MTLSamplerDescriptor(); sd.minFilter = .nearest; sd.magFilter = .nearest; sd.sAddressMode = .clampToEdge; sd.tAddressMode = .clampToEdge
    guard let sampler = device.makeSamplerState(descriptor: sd) else { throw error("sampler unavailable") }
    func buffer(_ values: [Float]) throws -> MTLBuffer {
        guard let result = values.withUnsafeBytes({ device.makeBuffer(bytes: $0.baseAddress!, length: $0.count, options: .storageModeShared) }) else { throw error("buffer unavailable") }
        return result
    }
    func texture(_ bytes: [UInt8], width: Int = 1) throws -> MTLTexture {
        guard width > 0, bytes.count == width * 4 else { throw error("texture byte count mismatch") }
        let td = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: width, height: 1, mipmapped: false)
        td.storageMode = .shared; td.usage = .shaderRead
        guard let result = device.makeTexture(descriptor: td) else { throw error("texture unavailable") }
        bytes.withUnsafeBytes { result.replace(region: MTLRegionMake2D(0, 0, width, 1), mipmapLevel: 0, withBytes: $0.baseAddress!, bytesPerRow: width * 4) }
        return result
    }
    let td = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: 1, height: 1, mipmapped: false)
    td.storageMode = .shared; td.usage = .renderTarget
    guard let target = device.makeTexture(descriptor: td) else { throw error("render target unavailable") }
    let cases = try JSONDecoder().decode([Sample].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[4])))
    var results: [[String: Any]] = []
    for sample in cases {
        guard sample.tint.count == 4, sample.normal.count == 3, sample.fresnel.count == 4 else { throw error("invalid bindings") }
        let scale = sample.scale ?? [1, 1, 1], normals = sample.normals ?? Array(repeating: sample.normal, count: 3).flatMap { $0 }, uv = sample.uv ?? [0.25, 0.5]
        guard scale.count == 3, scale.allSatisfy({ $0 != 0 }), normals.count == 9, uv.count == 2 else { throw error("invalid streams") }
        let points: [[Float]] = [[-1, -1, 0], [3, -1, 0], [-1, 3, 0]]
        var vertices: [Float] = []
        for i in 0..<3 { vertices += (0..<3).map { points[i][$0] / scale[$0] }; vertices += Array(normals[(i*3)..<(i*3+3)]); vertices += uv }
        var frame = [Float](repeating: 0, count: 140)
        // mProj is row-packed: map z=0 to Metal's clip z=.5. x/y/w match the WebGL fixture.
        frame[0] = 1; frame[5] = 1; frame[11] = 0.5; frame[15] = 1; frame[18] = 1000
        var world = [Float](repeating: 0, count: 76)
        world[0] = scale[0]; world[5] = scale[1]; world[10] = scale[2]; world[15] = 1
        var locals = [Float](repeating: 0, count: 36)
        locals.replaceSubrange(0..<4, with: sample.fresnel)
        let transform = sample.transform ?? [1,0,0,0,1,0,0,0,1]
        guard transform.count == 9 else { throw error("invalid UV matrix") }
        for r in 0..<3 { for c in 0..<3 { locals[4 + r*4 + c] = transform[c*3+r] } }
        locals.replaceSubrange(28..<32, with: sample.tint); locals[32] = sample.depthPushPull ?? 0
        let alpha = sample.alphaRef ?? 0
        let fragment: [Float] = alpha > 0 ? [alpha, 0.5, 0.5] : [0.5, 0.5]
        let buffers = try [buffer(vertices), buffer(frame), buffer(world), buffer(locals), buffer(fragment)]
        let textures = try [texture(sample.remap ?? [0,0,0,0]), texture(sample.source, width: sample.width ?? 1), texture(sample.lookup)]
        let pass = MTLRenderPassDescriptor(); pass.colorAttachments[0].texture = target; pass.colorAttachments[0].loadAction = .clear; pass.colorAttachments[0].storeAction = .store; pass.colorAttachments[0].clearColor = MTLClearColorMake(0,0,0,0)
        guard let command = queue.makeCommandBuffer(), let encoder = command.makeRenderCommandEncoder(descriptor: pass) else { throw error("command/encoder unavailable") }
        encoder.setRenderPipelineState(pipelines[alpha > 0 ? 1 : 0]); encoder.setCullMode(.none)
        encoder.setVertexBuffer(buffers[0], offset: 0, index: 0); encoder.setVertexBuffer(buffers[1], offset: 0, index: 1); encoder.setVertexBuffer(buffers[2], offset: 0, index: 2); encoder.setVertexBuffer(buffers[3], offset: 0, index: 9)
        encoder.setFragmentBuffer(buffers[4], offset: 0, index: 16)
        for i in 0..<3 { encoder.setFragmentTexture(textures[i], index: i) }
        for i in [0, 1, 15] { encoder.setFragmentSamplerState(sampler, index: i) }
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3); encoder.endEncoding(); command.commit(); command.waitUntilCompleted()
        guard command.status == .completed, command.error == nil else { throw command.error ?? error("GPU command failed") }
        var pixel = [UInt8](repeating: 0, count: 4)
        pixel.withUnsafeMutableBytes { target.getBytes($0.baseAddress!, bytesPerRow: 4, from: MTLRegionMake2D(0,0,1,1), mipmapLevel: 0) }
        results.append(["id": sample.id, "pixels": pixel, "vertexProgram": 1, "fragmentProgram": alpha > 0 ? 24 : 9, "commandStatus": "completed"])
    }
    let output: [String: Any] = ["scope": "Original retained VS1 and PS9/PS24 executed in an owned synthetic 1px Metal harness. No game process, native emitter dispatch or frame binding observed.", "device": device.name, "os": ProcessInfo.processInfo.operatingSystemVersionString, "results": results]
    print(String(decoding: try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys]), as: UTF8.self))
}
do { try run() } catch { fputs("\(error)\n", stderr); exit(1) }
