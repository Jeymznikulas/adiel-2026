using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.Application.Storage;

public sealed class BusinessImageService(IBusinessImageStorage storage, IImageReferenceRepository references, IImageCleanupQueue cleanup, ICurrentUserAccessor users)
{
    public const long MaximumBytes = 5 * 1024 * 1024;
    private static readonly TimeSpan ViewingLifetime = TimeSpan.FromMinutes(5);

    public async Task<ImageUploadResult> UploadAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, Stream input, long length, long version, CancellationToken token)
    {
        ValidateTarget(kind, variantId);
        if (version <= 0) throw new RequestValidationException("The current record version is required.");
        if (length is <= 0 or > MaximumBytes) throw new RequestValidationException("Images must be between 1 byte and 5 MB.");
        await using var content = new MemoryStream((int)length);
        await input.CopyToAsync(content, token);
        if (content.Length != length || content.Length > MaximumBytes) throw new RequestValidationException("The uploaded image size is invalid.");
        var detected = Detect(content.GetBuffer().AsSpan(0, checked((int)content.Length)));
        var actor = users.GetRequiredUser();
        var folder = kind.ToString().ToLowerInvariant() + "s";
        var target = variantId ?? entityId;
        var path = $"{actor.Id:N}/{folder}/{target:N}/{Guid.NewGuid():N}.{detected.Extension}";
        content.Position = 0;
        await storage.UploadAsync(path, content, detected.ContentType, token);
        ImageReference updated;
        try { updated = await references.ReplaceAsync(kind, entityId, variantId, path, version, actor, token); }
        catch { cleanup.Enqueue(path); throw; }
        if (IsOwnedPath(updated.PreviousObjectPath, actor.Id) && updated.PreviousObjectPath != path) cleanup.Enqueue(updated.PreviousObjectPath!);
        return new(path, await storage.CreateSignedUrlAsync(path, ViewingLifetime, token), updated.Version);
    }

    public async Task<string> ViewAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, CancellationToken token)
    {
        ValidateTarget(kind, variantId);
        var reference = await references.GetAsync(kind, entityId, variantId, token);
        if (string.IsNullOrWhiteSpace(reference.ObjectPath)) throw new ResourceNotFoundException("This record has no image.");
        if (!IsOwnedPath(reference.ObjectPath, users.GetRequiredUser().Id))
            throw new ResourceNotFoundException("The image was not found.");
        return await storage.CreateSignedUrlAsync(reference.ObjectPath, ViewingLifetime, token);
    }

    public async Task<ImageReference> RemoveAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, long version, CancellationToken token)
    {
        ValidateTarget(kind, variantId);
        var actor = users.GetRequiredUser();
        var updated = await references.ReplaceAsync(kind, entityId, variantId, null, version, actor, token);
        if (IsOwnedPath(updated.PreviousObjectPath, actor.Id)) cleanup.Enqueue(updated.PreviousObjectPath!);
        return updated;
    }

    private static bool IsOwnedPath(string? path, Guid ownerId) =>
        !string.IsNullOrWhiteSpace(path)
        && path.StartsWith(ownerId.ToString("N") + "/", StringComparison.Ordinal)
        && !path.Contains("..", StringComparison.Ordinal)
        && !path.Contains('\\');

    private static void ValidateTarget(BusinessImageKind kind, Guid? variantId)
    {
        if ((kind == BusinessImageKind.Variant) != variantId.HasValue) throw new RequestValidationException("The image target is invalid.");
    }

    private static (string Extension, string ContentType) Detect(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 8 && bytes[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a })) return ("png", "image/png");
        if (bytes.Length >= 4 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff && bytes[^2] == 0xff && bytes[^1] == 0xd9) return ("jpg", "image/jpeg");
        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)) return ("webp", "image/webp");
        throw new RequestValidationException("Only valid PNG, JPEG, and WebP images are allowed.");
    }
}
