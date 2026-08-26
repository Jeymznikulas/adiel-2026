using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Items;
using AdielSystem.Application.Settings;
using AdielSystem.Application.Storage;
using AdielSystem.Application.Suppliers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedImageEndpointTests
{
    [Fact]
    public async Task Business_images_bucket_is_private_when_available()
    {
        await using var factory = new OwnerApiFactory(); var token = TestContext.Current.CancellationToken;
        var state = await factory.QueryInTestTransactionAsync(async connection => { await using var command = connection.CreateCommand(); command.CommandText = "select public from storage.buckets where id='business-images'"; return await command.ExecuteScalarAsync(token); }, token);
        if (state is null or DBNull) Assert.Skip("The remote business-images bucket has not been created and no Storage administration credential is available.");
        Assert.False((bool)state);
    }

    [Fact]
    public async Task Owner_can_upload_view_replace_and_remove_private_client_image()
    {
        var storage = new FakeStorage(); var cleanup = new FakeCleanup();
        await using var factory = new OwnerApiFactory(services => { services.RemoveAll<IBusinessImageStorage>(); services.RemoveAll<IImageCleanupQueue>(); services.AddSingleton<IBusinessImageStorage>(storage); services.AddSingleton<IImageCleanupQueue>(cleanup); });
        using var client = factory.CreateClient(); var token = TestContext.Current.CancellationToken;
        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", token);
        var create = await client.PostAsJsonAsync("/api/v1/clients", new { name = $"Image Client {Guid.NewGuid():N}", photo = (string?)null, address = "Test", industry = industries!.First(x => x.IsActive).Name, clientSince = "2026-08-26", status = "Active", contacts = new[] { new { id = Guid.NewGuid(), name = "Owner", email = "image@example.com", phone = "123" } } }, token);
        create.EnsureSuccessStatusCode(); var entity = (await create.Content.ReadFromJsonAsync<ClientDto>(token))!;

        var invalid = await Upload(client, entity.Id, entity.Version, "fake.png", "image/png", "not-image"u8.ToArray(), token);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var tooLarge = await Upload(client, entity.Id, entity.Version, "huge.png", "image/png", new byte[BusinessImageService.MaximumBytes + 1], token);
        Assert.Equal(HttpStatusCode.BadRequest, tooLarge.StatusCode);

        var first = await Upload(client, entity.Id, entity.Version, "../../attack.exe", "application/octet-stream", Png(), token);
        Assert.True(first.IsSuccessStatusCode, await first.Content.ReadAsStringAsync(token)); var uploaded = (await first.Content.ReadFromJsonAsync<ImageUploadResult>(token))!;
        Assert.DoesNotContain("attack", uploaded.ObjectPath); Assert.DoesNotContain("..", uploaded.ObjectPath); Assert.EndsWith(".png", uploaded.ObjectPath);
        var saved = await client.GetFromJsonAsync<ClientDto>($"/api/v1/clients/{entity.Id}", token); Assert.Equal(uploaded.ObjectPath, saved!.Photo);
        var view = await client.GetFromJsonAsync<SignedUrlDto>($"/api/v1/clients/{entity.Id}/image", token); Assert.StartsWith("https://signed.example/", view!.Url);

        var second = await Upload(client, entity.Id, uploaded.Version, "replacement.webp", "image/webp", Webp(), token);
        second.EnsureSuccessStatusCode(); var replaced = (await second.Content.ReadFromJsonAsync<ImageUploadResult>(token))!;
        Assert.Contains(uploaded.ObjectPath, cleanup.Paths);
        var remove = await client.DeleteAsync($"/api/v1/clients/{entity.Id}/image?version={replaced.Version}", token); remove.EnsureSuccessStatusCode();
        Assert.Contains(replaced.ObjectPath, cleanup.Paths);
    }

    [Fact]
    public async Task Supplier_item_and_variant_images_update_their_own_references()
    {
        var storage = new FakeStorage();
        await using var factory = new OwnerApiFactory(services =>
        {
            services.RemoveAll<IBusinessImageStorage>();
            services.RemoveAll<IImageCleanupQueue>();
            services.AddSingleton<IBusinessImageStorage>(storage);
            services.AddSingleton<IImageCleanupQueue>(new FakeCleanup());
        });
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;

        var supplierCategories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=supplier_category", token);
        var supplierCreate = await client.PostAsJsonAsync("/api/v1/suppliers", new
        {
            name = $"Image Supplier {Guid.NewGuid():N}", logo = (string?)null, type = "Distributor", status = "Active", tin = "123-456-789",
            companyEmail = "image-supplier@example.com", companyPhone = "+63 900 000 0000", address = "Test", catalogUrl = "https://example.com/catalog",
            contacts = new[] { new { id = Guid.NewGuid(), name = "Image Owner", email = "image-owner@example.com", phone = "+63 900 000 0001" } },
            categories = new[] { supplierCategories!.First(x => x.IsActive).Name }, performanceNotes = Array.Empty<object>()
        }, token);
        supplierCreate.EnsureSuccessStatusCode();
        var supplier = (await supplierCreate.Content.ReadFromJsonAsync<SupplierDto>(token))!;
        var supplierUpload = await UploadPath(client, $"/api/v1/suppliers/{supplier.Id}/image", supplier.Version, Png(), token);
        Assert.True(supplierUpload.IsSuccessStatusCode, await supplierUpload.Content.ReadAsStringAsync(token));

        var itemCategories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=item_category", token);
        var code = $"IMG-{Guid.NewGuid():N}"[..18];
        var itemCreate = await client.PostAsJsonAsync("/api/v1/items", new
        {
            supplierId = supplier.Id, name = $"Image Item {Guid.NewGuid():N}", photo = (string?)null,
            category = itemCategories!.First(x => x.IsActive).Name, subcategory = "Images", brand = "ADIEL",
            unitOfMeasure = "Piece", unitWeight = 0, productCode = code, barcode = "", description = "Test",
            status = "Active", rawCost = 10m, sellingPrice = 15m, lastPriceUpdate = DateOnly.FromDateTime(DateTime.UtcNow)
        }, token);
        itemCreate.EnsureSuccessStatusCode();
        var item = (await itemCreate.Content.ReadFromJsonAsync<ItemDto>(token))!;
        var itemUpload = await UploadPath(client, $"/api/v1/items/{item.Id}/image", item.Version, Png(), token);
        itemUpload.EnsureSuccessStatusCode();
        var uploadedItem = (await itemUpload.Content.ReadFromJsonAsync<ImageUploadResult>(token))!;

        var addVariant = await client.PostAsJsonAsync($"/api/v1/items/{item.Id}/variants", new
        {
            name = "Size", value = "Large", photo = (string?)null, productCode = $"{code}-L", barcode = "",
            unitOfMeasure = "Piece", unitWeight = 0, status = "Active", rawCost = 11m, sellingPrice = 17m,
            specifications = Array.Empty<object>()
        }, token);
        addVariant.EnsureSuccessStatusCode();
        var withVariant = (await addVariant.Content.ReadFromJsonAsync<ItemDto>(token))!;
        var variant = Assert.Single(withVariant.Variants);
        var variantUpload = await UploadPath(client, $"/api/v1/items/{item.Id}/variants/{variant.Id}/image", variant.Version, Webp(), token);
        variantUpload.EnsureSuccessStatusCode();

        var saved = await client.GetFromJsonAsync<ItemDto>($"/api/v1/items/{item.Id}", token);
        Assert.Equal(uploadedItem.ObjectPath, saved!.Photo);
        Assert.EndsWith(".webp", Assert.Single(saved.Variants).Photo);
        Assert.NotNull(await client.GetFromJsonAsync<SignedUrlDto>($"/api/v1/suppliers/{supplier.Id}/image", token));
        Assert.NotNull(await client.GetFromJsonAsync<SignedUrlDto>($"/api/v1/items/{item.Id}/variants/{variant.Id}/image", token));
    }

    private static async Task<HttpResponseMessage> Upload(HttpClient client, Guid id, long version, string name, string type, byte[] bytes, CancellationToken token) { using var content = new MultipartFormDataContent(); var file = new ByteArrayContent(bytes); file.Headers.ContentType = MediaTypeHeaderValue.Parse(type); content.Add(file, "file", name); return await client.PostAsync($"/api/v1/clients/{id}/image?version={version}", content, token); }
    private static async Task<HttpResponseMessage> UploadPath(HttpClient client, string path, long version, byte[] bytes, CancellationToken token) { using var content = new MultipartFormDataContent(); content.Add(new ByteArrayContent(bytes), "file", "ignored.bin"); return await client.PostAsync($"{path}?version={version}", content, token); }
    private static byte[] Png()=>[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1]; private static byte[] Webp()=>[0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,1];
    private sealed record SignedUrlDto(string Url,int ExpiresIn);
    private sealed class FakeCleanup:IImageCleanupQueue{public List<string> Paths{get;}=[];public void Enqueue(string p)=>Paths.Add(p);}
    private sealed class FakeStorage:IBusinessImageStorage{public Task EnsurePrivateBucketAsync(CancellationToken t)=>Task.CompletedTask;public Task UploadAsync(string p,Stream s,string c,CancellationToken t)=>Task.CompletedTask;public Task DeleteAsync(string p,CancellationToken t)=>Task.CompletedTask;public Task<string>CreateSignedUrlAsync(string p,TimeSpan l,CancellationToken t)=>Task.FromResult("https://signed.example/"+p);}
}
