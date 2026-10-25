import Foundation
import Metal

struct Erosion: Decodable {
  var texel: [UInt8]
  var mixer: [Float]
  var drive: Float
  var slice: Float
  var featherIn: Float
  var featherOut: Float
  enum CodingKeys: String, CodingKey {
    case texel, mixer, drive, slice
    case featherIn = "in", featherOut = "out"
  }
}
struct Sample: Decodable {
  var id: String
  var source: [UInt8]
  var tint: [Float]
  var normal: [Float]
  var normals: [Float]?
  var power: Float
  var rim: [Float]
  var remap: [UInt8]?
  var width: Int?
  var uv: [Float]?
  var transform: [Float]?
  var erosion: Erosion
  var bones: [[Float]]?
  var joints: [UInt32]?
  var weights: [Float]?
  var lookup: [UInt8]?
  var lookupWidth: Int?
  var lookupUv: [Float]?
}
func failure(_ text: String) -> NSError {
  NSError(domain: "OwnedMetalSkinHarness", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
}
func run() throws {
  let lookup = CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "--lookup"
  let shift = lookup ? 1 : 0
  guard CommandLine.arguments.count == 4 + shift else { throw failure("usage: render [--lookup] VS0 PS34-or-PS11 cases.json") }
  guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else {
    throw failure("Metal device/queue unavailable")
  }
  func library(_ path: String) throws -> MTLLibrary {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))
    return try data.withUnsafeBytes { try device.makeLibrary(data: DispatchData(bytes: $0)) }
  }
  let vertex = try library(CommandLine.arguments[1 + shift]), fragment = try library(CommandLine.arguments[2 + shift])
  let descriptor = MTLVertexDescriptor()
  for (index, format, offset) in [
    (0, MTLVertexFormat.float3, 0), (1, .float4, 12), (2, .float3, 28),
    (7, .uint4, 40), (8, .float2, 56),
  ] {
    descriptor.attributes[index].format = format
    descriptor.attributes[index].offset = offset
    descriptor.attributes[index].bufferIndex = 20
  }
  descriptor.layouts[20].stride = 64
  let pipelineDescriptor = MTLRenderPipelineDescriptor()
  pipelineDescriptor.vertexFunction = vertex.makeFunction(name: "wrapped_main")
  pipelineDescriptor.fragmentFunction = fragment.makeFunction(name: "wrapped_main")
  pipelineDescriptor.vertexDescriptor = descriptor
  pipelineDescriptor.colorAttachments[0].pixelFormat = .rgba8Unorm
  let pipeline = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
  let samplerDescriptor = MTLSamplerDescriptor()
  samplerDescriptor.minFilter = .nearest; samplerDescriptor.magFilter = .nearest
  samplerDescriptor.sAddressMode = .clampToEdge; samplerDescriptor.tAddressMode = .clampToEdge
  guard let sampler = device.makeSamplerState(descriptor: samplerDescriptor) else { throw failure("sampler unavailable") }
  func buffer<T>(_ values: [T]) throws -> MTLBuffer {
    guard let result = values.withUnsafeBytes({ device.makeBuffer(bytes: $0.baseAddress!, length: $0.count, options: .storageModeShared) }) else { throw failure("buffer unavailable") }
    return result
  }
  func texture(_ bytes: [UInt8], width: Int = 1) throws -> MTLTexture {
    guard width > 0, bytes.count == width * 4 else { throw failure("texture extent differs") }
    let d = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: width, height: 1, mipmapped: false)
    d.storageMode = .shared; d.usage = .shaderRead
    guard let t = device.makeTexture(descriptor: d) else { throw failure("texture unavailable") }
    bytes.withUnsafeBytes { t.replace(region: MTLRegionMake2D(0, 0, width, 1), mipmapLevel: 0, withBytes: $0.baseAddress!, bytesPerRow: width * 4) }
    return t
  }
  let targetDescriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: 1, height: 1, mipmapped: false)
  targetDescriptor.storageMode = .shared; targetDescriptor.usage = .renderTarget
  guard let target = device.makeTexture(descriptor: targetDescriptor) else { throw failure("target unavailable") }
  let cases = try JSONDecoder().decode([Sample].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3 + shift])))
  let identity: [Float] = [1,0,0,0, 0,1,0,0, 0,0,1,0]
  let points: [[Float]] = [[-1,-1,0], [3,-1,0], [-1,3,0]]
  var results: [[String: Any]] = []
  for sample in cases {
    let normals = sample.normals ?? Array(repeating: sample.normal, count: 3).flatMap { $0 }
    let joints = sample.joints ?? [0,0,0,0]
    let weights = sample.weights ?? [1,0,0,0]
    let uv = sample.uv ?? [0.25,0.5]
    let transform = sample.transform ?? [1,0,0,0,1,0,0,0,1]
    let e = sample.erosion
    guard sample.tint.count == 4, sample.rim.count == 3, sample.power > 0,
      normals.count == 9, joints.count == 4, joints.allSatisfy({ $0 < 256 }),
      weights.count == 4 || weights.count == 12, uv.count == 2, transform.count == 9,
      e.mixer.count == 4, e.featherIn > 0, e.featherOut > 0,
      (normals + weights + uv + transform + sample.tint + sample.rim + e.mixer + [sample.power,e.drive,e.slice,e.featherIn,e.featherOut]).allSatisfy({ $0.isFinite })
    else { throw failure("invalid synthetic input") }
    var palette = Array(repeating: identity, count: 256).flatMap { $0 }
    if let bones = sample.bones {
      guard bones.count <= 256, bones.allSatisfy({ $0.count == 12 && $0.allSatisfy({ $0.isFinite }) }) else { throw failure("invalid bone palette") }
      for (i,bone) in bones.enumerated() { palette.replaceSubrange((i*12)..<(i*12+12), with: bone) }
    }
    var vertices: [UInt32] = []
    for i in 0..<3 {
      vertices += points[i].map { $0.bitPattern }
      vertices += (weights.count == 12 ? Array(weights[(i*4)..<(i*4+4)]) : weights).map { $0.bitPattern }
      vertices += normals[(i*3)..<(i*3+3)].map { $0.bitPattern }
      vertices += joints
      vertices += uv.map { $0.bitPattern }
    }
    var frame = [Float](repeating: 0, count: 140)
    // Explicit row-packed orthographic projection. Metal uses [0,1] clip depth.
    frame[0] = 1; frame[5] = 1; frame[10] = -1 / (2000 - 0.1)
    frame[11] = (1000 - 0.1) / (2000 - 0.1); frame[15] = 1; frame[18] = 1000
    var locals = [Float](repeating: 0, count: 36)
    locals.replaceSubrange(0..<4, with: sample.rim + [sample.power])
    for r in 0..<3 { for c in 0..<3 { locals[4+r*4+c] = transform[c*3+r] } }
    locals.replaceSubrange(28..<32, with: sample.tint)
    // Depth push is explicitly zero; the local skin material does not implement it.
    let lookupUv = sample.lookupUv ?? [0.5,0.5]
    guard lookupUv.count == 2, lookupUv.allSatisfy({ $0.isFinite }) else { throw failure("invalid lookup UV") }
    let fragmentValues = lookup ? lookupUv : [e.drive,e.slice,1/e.featherIn,1/e.featherOut] + e.mixer
    let buffers = try [buffer(palette),buffer(frame),buffer(locals),buffer(vertices),buffer(fragmentValues)]
    let textures = lookup
      ? try [texture(sample.remap ?? [0,0,0,0]),texture(sample.source,width: sample.width ?? 1),texture(sample.lookup ?? [255,255,255,255],width:sample.lookupWidth ?? 1)]
      : try [texture(sample.remap ?? [0,0,0,0]),texture(e.texel,width: sample.width ?? 1),texture(sample.source,width: sample.width ?? 1)]
    let pass = MTLRenderPassDescriptor()
    pass.colorAttachments[0].texture = target; pass.colorAttachments[0].loadAction = .clear
    pass.colorAttachments[0].storeAction = .store; pass.colorAttachments[0].clearColor = MTLClearColorMake(0,0,0,0)
    guard let command = queue.makeCommandBuffer(), let encoder = command.makeRenderCommandEncoder(descriptor: pass) else { throw failure("command/encoder unavailable") }
    encoder.setRenderPipelineState(pipeline)
    encoder.setCullMode(.none)
    encoder.setVertexBuffer(buffers[0],offset:0,index:0)
    encoder.setVertexBuffer(buffers[1],offset:0,index:1)
    encoder.setVertexBuffer(buffers[2],offset:0,index:9)
    encoder.setVertexBuffer(buffers[3],offset:0,index:20)
    encoder.setFragmentBuffer(buffers[4],offset:0,index:16)
    for i in 0..<3 { encoder.setFragmentTexture(textures[i],index:i) }
    for i in [0,1,15] { encoder.setFragmentSamplerState(sampler,index:i) }
    encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:3)
    encoder.endEncoding(); command.commit(); command.waitUntilCompleted()
    guard command.status == .completed else { throw command.error ?? failure("command did not complete") }
    var pixels = [UInt8](repeating:0,count:4)
    pixels.withUnsafeMutableBytes { target.getBytes($0.baseAddress!,bytesPerRow:4,from:MTLRegionMake2D(0,0,1,1),mipmapLevel:0) }
    results.append(["id":sample.id,"pixels":pixels,"commandStatus":"completed"])
  }
  let output: [String:Any] = ["device":device.name,"os":ProcessInfo.processInfo.operatingSystemVersionString,"results":results]
  let data = try JSONSerialization.data(withJSONObject:output,options:[.prettyPrinted,.sortedKeys])
  FileHandle.standardOutput.write(data)
}
do { try run() } catch {
  FileHandle.standardError.write(Data((String(describing:error)+"\n").utf8)); exit(1)
}
