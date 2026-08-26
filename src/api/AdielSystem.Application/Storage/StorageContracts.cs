using AdielSystem.Application.Security;

namespace AdielSystem.Application.Storage;

public enum BusinessImageKind { Client, Supplier, Item, Variant }
public sealed record ImageReference(string? ObjectPath, long Version, string? PreviousObjectPath = null);
public sealed record ImageUploadResult(string ObjectPath, string ViewingUrl, long Version);

public interface IBusinessImageStorage
{
    Task EnsurePrivateBucketAsync(CancellationToken token);
    Task UploadAsync(string objectPath, Stream content, string contentType, CancellationToken token);
    Task DeleteAsync(string objectPath, CancellationToken token);
    Task<string> CreateSignedUrlAsync(string objectPath, TimeSpan lifetime, CancellationToken token);
}

public interface IImageReferenceRepository
{
    Task<ImageReference> GetAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, CancellationToken token);
    Task<ImageReference> ReplaceAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, string? objectPath, long expectedVersion, CurrentUser actor, CancellationToken token);
}

public interface IImageCleanupQueue { void Enqueue(string objectPath); }
