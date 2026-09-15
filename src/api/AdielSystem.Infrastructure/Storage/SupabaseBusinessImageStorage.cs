using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AdielSystem.Application.Storage;
using AdielSystem.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace AdielSystem.Infrastructure.Storage;

internal sealed class SupabaseBusinessImageStorage(HttpClient client, IOptions<SupabaseOptions> supabase, IOptions<SupabaseStorageOptions> storage) : IBusinessImageStorage
{
    private SupabaseStorageOptions Options => storage.Value;

    public async Task EnsurePrivateBucketAsync(CancellationToken token)
    {
        using var response = await SendAsync(HttpMethod.Get, $"storage/v1/bucket/{Uri.EscapeDataString(Options.Bucket)}", null, token);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            using var create = await SendAsync(HttpMethod.Post, "storage/v1/bucket", JsonContent.Create(new { id = Options.Bucket, name = Options.Bucket, @public = false, file_size_limit = BusinessImageService.MaximumBytes, allowed_mime_types = new[] { "image/png", "image/jpeg", "image/webp" } }), token);
            await EnsureSuccessAsync(create, token); return;
        }
        await EnsureSuccessAsync(response, token);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(token));
        if (document.RootElement.TryGetProperty("public", out var value) && value.GetBoolean()) throw new InvalidOperationException("The business-images bucket exists but is public.");
    }

    public async Task UploadAsync(string objectPath, Stream content, string contentType, CancellationToken token)
    {
        ValidatePath(objectPath);
        using var body = new StreamContent(content); body.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        using var response = await SendAsync(HttpMethod.Post, $"storage/v1/object/{BucketPath(objectPath)}", body, token, request => request.Headers.TryAddWithoutValidation("x-upsert", "false"));
        await EnsureSuccessAsync(response, token);
    }

    public async Task DeleteAsync(string objectPath, CancellationToken token)
    {
        ValidatePath(objectPath);
        using var response = await SendAsync(HttpMethod.Delete, $"storage/v1/object/{BucketPath(objectPath)}", null, token);
        if (response.StatusCode != HttpStatusCode.NotFound) await EnsureSuccessAsync(response, token);
    }

    public async Task<string> CreateSignedUrlAsync(string objectPath, TimeSpan lifetime, CancellationToken token)
    {
        ValidatePath(objectPath);
        using var response = await SendAsync(HttpMethod.Post, $"storage/v1/object/sign/{BucketPath(objectPath)}", JsonContent.Create(new { expiresIn = checked((int)lifetime.TotalSeconds) }), token);
        await EnsureSuccessAsync(response, token);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(token));
        var signed = document.RootElement.GetProperty("signedURL").GetString() ?? throw new InvalidOperationException("Storage did not return a signed URL.");
        return ResolveSignedUrl(supabase.Value.Url, signed).ToString();
    }

    internal static Uri ResolveSignedUrl(Uri projectUrl, string signedPath)
    {
        if (Uri.TryCreate(signedPath, UriKind.Absolute, out var absolute)
            && (absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps)) return absolute;
        var storagePath = signedPath.StartsWith("/storage/v1/", StringComparison.Ordinal)
            ? signedPath
            : "/storage/v1/" + signedPath.TrimStart('/');
        return new Uri(projectUrl, storagePath);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string relative, HttpContent? content, CancellationToken token, Action<HttpRequestMessage>? configure = null)
    {
        if (string.IsNullOrWhiteSpace(Options.ServiceRoleKey)) throw new InvalidOperationException("Supabase:Storage:ServiceRoleKey must be configured through external secret storage.");
        var request = new HttpRequestMessage(method, new Uri(supabase.Value.Url, relative)) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Options.ServiceRoleKey);
        request.Headers.TryAddWithoutValidation("apikey", Options.ServiceRoleKey);
        configure?.Invoke(request);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
    }

    private string BucketPath(string path) => Uri.EscapeDataString(Options.Bucket) + "/" + string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
    private static void ValidatePath(string path) { if (string.IsNullOrWhiteSpace(path) || path.StartsWith('/') || path.Contains("..", StringComparison.Ordinal) || path.Contains('\\')) throw new InvalidOperationException("Unsafe Storage object path."); }
    private static Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Supabase Storage request failed with HTTP {(int)response.StatusCode}.");
        return Task.CompletedTask;
    }
}
