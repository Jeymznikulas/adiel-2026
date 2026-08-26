using AdielSystem.Infrastructure.Storage;

namespace AdielSystem.IntegrationTests;

public sealed class StorageSignedUrlTests
{
    [Theory]
    [InlineData("/object/sign/business-images/owner/clients/id/image.png?token=test")]
    [InlineData("/storage/v1/object/sign/business-images/owner/clients/id/image.png?token=test")]
    public void Signed_storage_paths_include_the_storage_api_prefix(string returnedPath)
    {
        var result = SupabaseBusinessImageStorage.ResolveSignedUrl(
            new Uri("https://project.supabase.co"),
            returnedPath);

        Assert.Equal(
            "/storage/v1/object/sign/business-images/owner/clients/id/image.png",
            result.AbsolutePath);
        Assert.Equal("?token=test", result.Query);
    }
}
