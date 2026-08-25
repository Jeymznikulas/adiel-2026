using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Items;
using AdielSystem.Application.Settings;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedItemCrudTests
{
    [Fact]
    public async Task Owner_can_manage_an_item_variant_price_history_archive_and_restore_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var categories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=item_category", token);
        var category = categories!.First(option => option.IsActive).Name;
        var code = $"IT-{Guid.NewGuid():N}"[..18];
        var name = $"Integration Item {Guid.NewGuid():N}";
        var create = await client.PostAsJsonAsync("/api/v1/items", new { supplierId = (Guid?)null, name, photo = (string?)null, category, subcategory = "Integration", brand = "ADIEL", unitOfMeasure = "Piece", unitWeight = 0, productCode = code, barcode = "", description = "Integration item", status = "Active", rawCost = 100m, sellingPrice = 150m, lastPriceUpdate = DateOnly.FromDateTime(DateTime.UtcNow) }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.NotNull(created);
        Assert.Single(created.PriceAdjustments);

        var addVariant = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/variants", new { name = "Size", value = "Large", photo = (string?)null, productCode = $"{code}-L", barcode = "", unitOfMeasure = "Piece", unitWeight = 0, status = "Active", rawCost = 110m, sellingPrice = 170m, specifications = new[] { new { id = (Guid?)null, name = "Length", value = "3 m" } } }, token);
        addVariant.EnsureSuccessStatusCode();
        var withVariant = await addVariant.Content.ReadFromJsonAsync<ItemDto>(token);
        var variant = Assert.Single(withVariant!.Variants);

        var adjust = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/price-adjustments", new { variantId = variant.Id, rawCost = 120m, sellingPrice = 180m, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Integration adjustment", notes = "Verified", itemVersion = withVariant.Version, variantVersion = variant.Version }, token);
        adjust.EnsureSuccessStatusCode();
        var adjusted = await adjust.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.Contains(adjusted!.PriceAdjustments, entry => entry.VariantId == variant.Id && entry.RawCost == 120m);

        var archive = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/archive", new { version = adjusted.Version }, token);
        archive.EnsureSuccessStatusCode();
        var archived = await archive.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.NotNull(archived!.ArchivedAt);
        var restore = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/restore", new { version = archived.Version }, token);
        restore.EnsureSuccessStatusCode();
        var restored = await restore.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.Null(restored!.ArchivedAt);
    }
}
