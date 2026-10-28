using LeagueToolkit.Core.Animation;
using System.Numerics;
using System.Security.Cryptography;
using System.Text.Json;

static uint Elf(string value) {
    uint hash=0;
    foreach(char c in value.ToLowerInvariant()) {
        hash=(hash<<4)+c;
        uint high=hash&0xf0000000;
        if(high!=0) hash^=high>>24;
        hash&=~high;
    }
    return hash;
}
static string Hash(string path)=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
static void Require(bool ok,string message) {if(!ok)throw new InvalidDataException(message);}
using var config=JsonDocument.Parse(File.ReadAllText(args[0]));
var models=new List<object>();
foreach(var model in config.RootElement.GetProperty("models").EnumerateArray()) {
    string skeleton=model.GetProperty("skeleton").GetString()!;
    Require(Hash(skeleton)==model.GetProperty("sha256").GetString(),"Skeleton hash differs");
    using var stream=File.OpenRead(skeleton);
    var rig=new RigResource(stream);
    Require(rig.Joints.All(j=>j.Name.All(c=>c<128)),"Non-ASCII joint hash policy unresolved");
    var joints=rig.Joints.ToDictionary(j=>Elf(j.Name),j=>j.Name);
    var clips=new List<object>();
    foreach(var clip in model.GetProperty("clips").EnumerateArray()) {
        string path=clip.GetProperty("path").GetString()!;
        Require(Hash(path)==clip.GetProperty("sha256").GetString(),"Animation hash differs");
        using var file=File.OpenRead(path);
        using var animation=AnimationAsset.Load(file);
        Require(float.IsFinite(animation.Duration)&&animation.Duration>=0&&animation.Duration<=600,"Invalid duration");
        Require(float.IsFinite(animation.Fps)&&animation.Fps>0&&animation.Fps<=1000,"Invalid source FPS");
        int frames=(int)MathF.Ceiling(animation.Duration*animation.Fps);
        var hashes=new HashSet<uint>();
        var pose=new Dictionary<uint,(Quaternion Rotation,Vector3 Translation,Vector3 Scale)>();
        for(int frame=0;frame<=frames;frame++) {
            pose.Clear();
            animation.Evaluate(MathF.Min(frame/animation.Fps,animation.Duration),pose);
            foreach(var hash in pose.Keys)hashes.Add(hash);
        }
        pose.Clear();animation.Evaluate(animation.Duration,pose);
        foreach(var hash in pose.Keys)hashes.Add(hash);
        Require(hashes.Count>0,"Empty animation binding remains unresolved");
        var matched=hashes.Where(joints.ContainsKey).OrderBy(k=>k).Select(k=>joints[k]).ToArray();
        clips.Add(new {state=clip.GetProperty("state").GetString(),source=clip.GetProperty("source").GetString(),sha256=Hash(path),
            duration=(double)animation.Duration,durationFloat32Bits=BitConverter.SingleToInt32Bits(animation.Duration).ToString("x8"),fps=(double)animation.Fps,
            evaluatedSourceTimes=frames+2,sourceJointHashes=hashes.OrderBy(k=>k).Select(k=>k.ToString("x8")).ToArray(),matchedRigJoints=matched,
            unbound=matched.Length==0});
    }
    models.Add(new{name=model.GetProperty("name").GetString(),skeletonSha256=Hash(skeleton),
        joints=joints.OrderBy(p=>p.Key).Select(p=>new{hash=p.Key.ToString("x8"),name=p.Value}).ToArray(),clips});
}
using var output=new FileStream(args[1],FileMode.CreateNew);
JsonSerializer.Serialize(output,models,new JsonSerializerOptions{WriteIndented=true});
