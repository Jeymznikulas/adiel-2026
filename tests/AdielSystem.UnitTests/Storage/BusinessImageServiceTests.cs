using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Storage;

namespace AdielSystem.UnitTests.Storage;

public sealed class BusinessImageServiceTests
{
    [Theory]
    [InlineData("png")]
    [InlineData("jpg")]
    [InlineData("webp")]
    public async Task Upload_detects_signature_generates_safe_path_and_replaces_reference(string format)
    {
        var storage = new FakeStorage(); var repository = new FakeReferences { Replacement = new("new", 2, "11111111111111111111111111111111/clients/entity/old.jpg") }; var cleanup = new FakeCleanup();
        var service = new BusinessImageService(storage, repository, cleanup, new FakeUser());
        var bytes = Image(format); var result = await service.UploadAsync(BusinessImageKind.Client, Guid.NewGuid(), null, new MemoryStream(bytes), bytes.Length, 1, TestContext.Current.CancellationToken);
        Assert.StartsWith("11111111111111111111111111111111/clients/", result.ObjectPath);
        Assert.EndsWith('.' + format, result.ObjectPath.Replace("jpeg", "jpg"));
        Assert.DoesNotContain("..", result.ObjectPath); Assert.Equal("11111111111111111111111111111111/clients/entity/old.jpg", Assert.Single(cleanup.Paths)); Assert.Equal(2, result.Version);
    }

    [Fact]
    public async Task Upload_rejects_invalid_signature_and_size_before_storage()
    {
        var storage = new FakeStorage(); var service = new BusinessImageService(storage, new FakeReferences(), new FakeCleanup(), new FakeUser());
        await Assert.ThrowsAsync<RequestValidationException>(() => service.UploadAsync(BusinessImageKind.Item, Guid.NewGuid(), null, new MemoryStream("not an image"u8.ToArray()), 12, 1, TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<RequestValidationException>(() => service.UploadAsync(BusinessImageKind.Item, Guid.NewGuid(), null, Stream.Null, BusinessImageService.MaximumBytes + 1, 1, TestContext.Current.CancellationToken));
        Assert.Empty(storage.Uploaded);
    }

    [Fact]
    public async Task Failed_reference_update_queues_uploaded_object_for_cleanup()
    {
        var storage = new FakeStorage(); var repository = new FakeReferences { Failure = new ConcurrencyConflictException("stale") }; var cleanup = new FakeCleanup();
        var service = new BusinessImageService(storage, repository, cleanup, new FakeUser()); var bytes = Image("png");
        await Assert.ThrowsAsync<ConcurrencyConflictException>(() => service.UploadAsync(BusinessImageKind.Supplier, Guid.NewGuid(), null, new MemoryStream(bytes), bytes.Length, 1, TestContext.Current.CancellationToken));
        Assert.Equal(Assert.Single(storage.Uploaded), Assert.Single(cleanup.Paths));
    }

    [Fact]
    public async Task Replacement_does_not_delete_a_legacy_external_url()
    {
        var repository = new FakeReferences { Replacement = new("new", 2, "https://placehold.co/400") };
        var cleanup = new FakeCleanup(); var bytes = Image("png");
        var service = new BusinessImageService(new FakeStorage(), repository, cleanup, new FakeUser());

        await service.UploadAsync(BusinessImageKind.Client, Guid.NewGuid(), null, new MemoryStream(bytes), bytes.Length, 1, TestContext.Current.CancellationToken);

        Assert.Empty(cleanup.Paths);
    }

    private static byte[] Image(string format) => format switch { "png" => [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1], "jpg" => [0xff,0xd8,0xff,1,0xff,0xd9], _ => [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,1] };
    private sealed class FakeUser : ICurrentUserAccessor { public CurrentUser GetRequiredUser() => new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "Owner"); }
    private sealed class FakeCleanup : IImageCleanupQueue { public List<string> Paths { get; }=[]; public void Enqueue(string path)=>Paths.Add(path); }
    private sealed class FakeStorage : IBusinessImageStorage { public List<string> Uploaded { get; }=[]; public Task EnsurePrivateBucketAsync(CancellationToken t)=>Task.CompletedTask; public Task UploadAsync(string p,Stream c,string type,CancellationToken t){Uploaded.Add(p);return Task.CompletedTask;} public Task DeleteAsync(string p,CancellationToken t)=>Task.CompletedTask; public Task<string>CreateSignedUrlAsync(string p,TimeSpan l,CancellationToken t)=>Task.FromResult("https://signed.example/"+p); }
    private sealed class FakeReferences : IImageReferenceRepository { public ImageReference Replacement { get; set; }=new("new",2); public Exception? Failure { get; set; } public Task<ImageReference>GetAsync(BusinessImageKind k,Guid e,Guid?v,CancellationToken t)=>Task.FromResult(Replacement); public Task<ImageReference>ReplaceAsync(BusinessImageKind k,Guid e,Guid?v,string?p,long ver,CurrentUser a,CancellationToken t)=>Failure is null?Task.FromResult(Replacement):Task.FromException<ImageReference>(Failure); }
}
