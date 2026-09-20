using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AdielSystem.Application.Items;
using AdielSystem.Application.Settings;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedItemCrudTests
{
    [Fact]
    public async Task Item_directory_preserves_related_data_filters_pagination_and_summary()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var categoryResponse = await client.GetAsync("/api/v1/settings/options?type=item_category", token);
        Assert.True(categoryResponse.IsSuccessStatusCode, await categoryResponse.Content.ReadAsStringAsync(token));
        var categories = await categoryResponse.Content.ReadFromJsonAsync<BusinessOptionDto[]>(token);
        var category = categories!.First(option => option.IsActive).Name;
        var stopwatch = Stopwatch.StartNew();
        var existingPage = (await client.GetFromJsonAsync<ItemPageDto>("/api/v1/items?pageSize=100", token))!;
        stopwatch.Stop();
        Assert.Equal(Math.Min(100L, existingPage.Total), existingPage.Items.Count);
        TestContext.Current.TestOutputHelper?.WriteLine($"Existing item page: {existingPage.Items.Count} items loaded in {stopwatch.Elapsed.TotalMilliseconds:F0} ms.");
        var prefix = $"Batch-{Guid.NewGuid():N}";
        var items = new List<ItemDto>();
        foreach (var suffix in new[] { "A", "B", "C" })
        {
            var request = new SaveItemRequest(null, $"{prefix}-{suffix}", null, category, "Batch", "ADIEL", "Piece", 0, $"{prefix}-{suffix}", "", "Batch loading test", suffix == "B" ? "Inactive" : "Active", 100m, 150m, DateOnly.FromDateTime(DateTime.UtcNow));
            var response = await client.PostAsJsonAsync("/api/v1/items", request, token);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            items.Add((await response.Content.ReadFromJsonAsync<ItemDto>(token))!);
        }
        for (var index = 0; index < 2; index++)
        {
            var response = await client.PostAsJsonAsync($"/api/v1/items/{items[index].Id}/variants", new SaveItemVariantRequest(null, "Size", index == 0 ? "Large" : "Small", null, $"{prefix}-V{index}", "", "Box", 2m, "Active", 110m, 170m, index == 0 ? [new(null, "Length", "3 m"), new(null, "Color", "Orange")] : []), token);
            response.EnsureSuccessStatusCode();
            items[index] = (await response.Content.ReadFromJsonAsync<ItemDto>(token))!;
        }
        var archive = await client.PostAsJsonAsync($"/api/v1/items/{items[2].Id}/archive", new ChangeItemArchiveRequest(items[2].Version), token);
        archive.EnsureSuccessStatusCode();
        items[2] = (await archive.Content.ReadFromJsonAsync<ItemDto>(token))!;

        var query = $"/api/v1/items?search={prefix}&sort=name";
        var active = (await client.GetFromJsonAsync<ItemPageDto>(query, token))!;
        Assert.Equal(2, active.Total);
        Assert.Equal(items.Take(2).Select(item => item.Id), active.Items.Select(item => item.Id));
        var all = (await client.GetFromJsonAsync<ItemPageDto>(query + "&includeArchived=true", token))!;
        Assert.Equal(3, all.Total);
        Assert.Equal(items.Select(item => item.Id), all.Items.Select(item => item.Id));
        foreach (var listed in all.Items)
        {
            var detail = await client.GetFromJsonAsync<ItemDto>($"/api/v1/items/{listed.Id}", token);
            Assert.Equal(JsonSerializer.Serialize(detail), JsonSerializer.Serialize(listed));
        }
        Assert.Equal(new[] { "Length", "Color" }, Assert.Single(all.Items[0].Variants).Specifications.Select(spec => spec.Name));
        Assert.Empty(Assert.Single(all.Items[1].Variants).Specifications);
        Assert.Empty(all.Items[2].Variants);

        var secondPage = (await client.GetFromJsonAsync<ItemPageDto>(query + "&includeArchived=true&pageSize=1&page=2", token))!;
        Assert.Equal(items[1].Id, Assert.Single(secondPage.Items).Id);
        Assert.Equal(3, secondPage.Total);
        Assert.Equal(all.Summary, secondPage.Summary);
        var emptyPage = (await client.GetFromJsonAsync<ItemPageDto>(query + "&includeArchived=true&pageSize=1&page=4", token))!;
        Assert.Empty(emptyPage.Items);
        Assert.Equal(3, emptyPage.Total);
        Assert.Equal(all.Summary, emptyPage.Summary);
        var noMatch = (await client.GetFromJsonAsync<ItemPageDto>($"/api/v1/items?search={prefix}-missing", token))!;
        Assert.Empty(noMatch.Items);
        Assert.Equal(0, noMatch.Total);
        Assert.Equal(all.Summary, noMatch.Summary);
        var invalidArchiveFilter = await client.GetAsync(query + "&includeArchived=true&archivedOnly=true", token);
        Assert.Equal(HttpStatusCode.BadRequest, invalidArchiveFilter.StatusCode);
        var inactive = (await client.GetFromJsonAsync<ItemPageDto>(query + $"&status=Inactive&category={Uri.EscapeDataString(category)}", token))!;
        Assert.Equal(items[1].Id, Assert.Single(inactive.Items).Id);

        var expectedSummary = await factory.QueryInTestTransactionAsync(async connection =>
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "select count(*),count(*) filter (where status='Active'),count(distinct lower(category)),coalesce(avg(case when selling_price>0 then ((selling_price-raw_cost)/selling_price)*100 else 0 end),0) from public.items where deleted_at is null and archived_at is null";
            await using var reader = await command.ExecuteReaderAsync(token);
            await reader.ReadAsync(token);
            return new ItemDirectorySummaryDto(reader.GetInt64(0), reader.GetInt64(1), reader.GetInt64(2), reader.GetDecimal(3));
        }, token);
        Assert.Equal(expectedSummary, all.Summary);
    }

    [Fact]
    public async Task Owner_can_manage_an_item_variant_price_history_archive_and_restore_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var categoryResponse = await client.GetAsync("/api/v1/settings/options?type=item_category", token);
        Assert.True(categoryResponse.IsSuccessStatusCode, await categoryResponse.Content.ReadAsStringAsync(token));
        var categories = await categoryResponse.Content.ReadFromJsonAsync<BusinessOptionDto[]>(token);
        var category = categories!.First(option => option.IsActive).Name;
        var code = $"IT-{Guid.NewGuid():N}"[..18];
        var name = $"Integration Item {Guid.NewGuid():N}";
        var create = await client.PostAsJsonAsync("/api/v1/items", new { supplierId = (Guid?)null, name, photo = (string?)null, category, subcategory = "Integration", brand = "ADIEL", unitOfMeasure = "Piece", unitWeight = 0, productCode = code, barcode = "", description = "Integration item", status = "Active", rawCost = 100m, sellingPrice = 150m, lastPriceUpdate = DateOnly.FromDateTime(DateTime.UtcNow) }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.NotNull(created);
        Assert.Single(created.PriceAdjustments);

        var addVariant = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/variants", new { supplierId = (Guid?)null, name = "Size", value = "Large", photo = (string?)null, productCode = $"{code}-L", barcode = "", unitOfMeasure = "Piece", unitWeight = 0, status = "Active", rawCost = 110m, sellingPrice = 170m, specifications = new[] { new { id = (Guid?)null, name = "Length", value = "3 m" } } }, token);
        addVariant.EnsureSuccessStatusCode();
        var withVariant = await addVariant.Content.ReadFromJsonAsync<ItemDto>(token);
        var variant = Assert.Single(withVariant!.Variants);

        var adjust = await client.PostAsJsonAsync($"/api/v1/items/{created.Id}/price-adjustments", new { variantId = variant.Id, rawCost = 120m, sellingPrice = 180m, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Integration adjustment", notes = "Verified", itemVersion = withVariant.Version, variantVersion = variant.Version }, token);
        adjust.EnsureSuccessStatusCode();
        var adjusted = await adjust.Content.ReadFromJsonAsync<ItemDto>(token);
        Assert.Contains(adjusted!.PriceAdjustments, entry => entry.VariantId == variant.Id && entry.RawCost == 120m);

        var directory = await client.GetFromJsonAsync<ItemPageDto>($"/api/v1/items?search={code}", token);
        var listed = Assert.Single(directory!.Items);
        Assert.Equal(JsonSerializer.Serialize(adjusted), JsonSerializer.Serialize(listed));

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
