using AdielSystem.Api.Security;
using AdielSystem.Application.Storage;

namespace AdielSystem.Api.Endpoints;

public static class ImageEndpoints
{
    public static RouteGroupBuilder MapImageEndpoints(this RouteGroupBuilder group)
    {
        MapTarget(group.MapGroup("/clients/{id:guid}/image"), BusinessImageKind.Client);
        MapTarget(group.MapGroup("/suppliers/{id:guid}/image"), BusinessImageKind.Supplier);
        MapTarget(group.MapGroup("/items/{id:guid}/image"), BusinessImageKind.Item);
        var variants = group.MapGroup("/items/{id:guid}/variants/{variantId:guid}/image").WithTags("Images").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        variants.MapPost("/", (Guid id, Guid variantId, long version, IFormFile file, BusinessImageService service, CancellationToken token) => Upload(service, BusinessImageKind.Variant, id, variantId, version, file, token)).DisableAntiforgery();
        variants.MapGet("/", async (Guid id, Guid variantId, BusinessImageService service, CancellationToken token) => Results.Ok(new { url = await service.ViewAsync(BusinessImageKind.Variant, id, variantId, token), expiresIn = 300 }));
        variants.MapDelete("/", async (Guid id, Guid variantId, long version, BusinessImageService service, CancellationToken token) => Results.Ok(await service.RemoveAsync(BusinessImageKind.Variant, id, variantId, version, token)));
        return group;
    }

    private static void MapTarget(RouteGroupBuilder target, BusinessImageKind kind)
    {
        target.WithTags("Images").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        target.MapPost("/", (Guid id, long version, IFormFile file, BusinessImageService service, CancellationToken token) => Upload(service, kind, id, null, version, file, token)).DisableAntiforgery();
        target.MapGet("/", async (Guid id, BusinessImageService service, CancellationToken token) => Results.Ok(new { url = await service.ViewAsync(kind, id, null, token), expiresIn = 300 }));
        target.MapDelete("/", async (Guid id, long version, BusinessImageService service, CancellationToken token) => Results.Ok(await service.RemoveAsync(kind, id, null, version, token)));
    }

    private static async Task<IResult> Upload(BusinessImageService service, BusinessImageKind kind, Guid id, Guid? variantId, long version, IFormFile file, CancellationToken token)
    {
        await using var stream = file.OpenReadStream();
        return Results.Ok(await service.UploadAsync(kind, id, variantId, stream, file.Length, version, token));
    }
}
