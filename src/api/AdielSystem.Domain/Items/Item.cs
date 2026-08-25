using AdielSystem.Domain.Common;

namespace AdielSystem.Domain.Items;

public sealed class Item : Entity
{
    private Item() { }

    public Guid? SupplierId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? PhotoPath { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public string Subcategory { get; private set; } = string.Empty;
    public string Brand { get; private set; } = string.Empty;
    public string UnitOfMeasure { get; private set; } = string.Empty;
    public decimal UnitWeight { get; private set; }
    public string ProductCode { get; private set; } = string.Empty;
    public string Barcode { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public ItemStatus Status { get; private set; }
    public decimal RawCost { get; private set; }
    public decimal SellingPrice { get; private set; }
    public DateOnly? LastPriceUpdate { get; private set; }
    public IReadOnlyList<ItemVariant> Variants { get; private set; } = [];
    public IReadOnlyList<ItemPriceAdjustment> PriceAdjustments { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public long Version { get; private set; }

    public static Item Create(Guid id, Guid? supplierId, string name, string? photoPath, string category, string subcategory, string brand, string unitOfMeasure, decimal unitWeight, string? productCode, string? barcode, string? description, ItemStatus status, decimal rawCost, decimal sellingPrice, DateOnly? lastPriceUpdate)
    {
        var now = DateTimeOffset.UtcNow;
        var item = new Item { Id = id == Guid.Empty ? Guid.NewGuid() : id, CreatedAt = now, UpdatedAt = now, Version = 1 };
        item.SetDetails(supplierId, name, photoPath, category, subcategory, brand, unitOfMeasure, unitWeight, productCode, barcode, description, status, rawCost, sellingPrice, lastPriceUpdate);
        return item;
    }

    public static Item Rehydrate(Guid id, Guid? supplierId, string name, string? photoPath, string category, string subcategory, string brand, string unitOfMeasure, decimal unitWeight, string? productCode, string? barcode, string? description, ItemStatus status, decimal rawCost, decimal sellingPrice, DateOnly? lastPriceUpdate, IEnumerable<ItemVariant> variants, IEnumerable<ItemPriceAdjustment> priceAdjustments, DateTimeOffset createdAt, DateTimeOffset updatedAt, DateTimeOffset? archivedAt, long version)
    {
        var item = new Item { Id = id, CreatedAt = createdAt, UpdatedAt = updatedAt, ArchivedAt = archivedAt, Version = version, Variants = variants.ToArray(), PriceAdjustments = priceAdjustments.ToArray() };
        item.SetDetails(supplierId, name, photoPath, category, subcategory, brand, unitOfMeasure, unitWeight, productCode, barcode, description, status, rawCost, sellingPrice, lastPriceUpdate);
        return item;
    }

    public void Update(Guid? supplierId, string name, string? photoPath, string category, string subcategory, string brand, string unitOfMeasure, decimal unitWeight, string? productCode, string? barcode, string? description, ItemStatus status, decimal rawCost, decimal sellingPrice, DateOnly? lastPriceUpdate)
    {
        if (ArchivedAt is not null) throw new ArgumentException("An archived item must be restored before it can be edited.");
        SetDetails(supplierId, name, photoPath, category, subcategory, brand, unitOfMeasure, unitWeight, productCode, barcode, description, status, rawCost, sellingPrice, lastPriceUpdate);
    }

    public void Archive(DateTimeOffset occurredAt) => ArchivedAt ??= occurredAt;
    public void Restore() => ArchivedAt = null;

    private void SetDetails(Guid? supplierId, string name, string? photoPath, string category, string subcategory, string brand, string unitOfMeasure, decimal unitWeight, string? productCode, string? barcode, string? description, ItemStatus status, decimal rawCost, decimal sellingPrice, DateOnly? lastPriceUpdate)
    {
        SupplierId = supplierId;
        Name = Required(name, nameof(name), 200);
        PhotoPath = OptionalPath(photoPath, "Item photos must be uploaded to private storage.");
        Category = Required(category, nameof(category), 100);
        Subcategory = Optional(subcategory, 100);
        Brand = Optional(brand, 100);
        UnitOfMeasure = Required(unitOfMeasure, nameof(unitOfMeasure), 60);
        if (unitWeight < 0) throw new ArgumentException("Unit weight cannot be negative.", nameof(unitWeight));
        UnitWeight = unitWeight;
        ProductCode = Optional(productCode, 100);
        Barcode = Optional(barcode, 100);
        Description = Optional(description, 4000);
        if (rawCost < 0 || sellingPrice < 0) throw new ArgumentException("Prices cannot be negative.");
        Status = status; RawCost = rawCost; SellingPrice = sellingPrice; LastPriceUpdate = lastPriceUpdate;
    }

    private static string Required(string? value, string parameterName, int maximumLength) { var normalized = value?.Trim() ?? string.Empty; if (normalized.Length is 0 or > 200 || normalized.Length > maximumLength) throw new ArgumentException($"The value must be between 1 and {maximumLength} characters.", parameterName); return normalized; }
    private static string Optional(string? value, int maximumLength) { var normalized = value?.Trim() ?? string.Empty; if (normalized.Length > maximumLength) throw new ArgumentException($"The value cannot exceed {maximumLength} characters."); return normalized; }
    private static string? OptionalPath(string? value, string error) { if (string.IsNullOrWhiteSpace(value)) return null; var normalized = value.Trim(); if (normalized.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException(error); if (normalized.Length > 500) throw new ArgumentException("The photo path is too long."); return normalized; }
}

public sealed record ItemVariant(Guid Id, string Name, string Value, string? PhotoPath, string ProductCode, string Barcode, string UnitOfMeasure, decimal UnitWeight, ItemStatus Status, decimal RawCost, decimal SellingPrice, int SortOrder, IReadOnlyList<ItemVariantSpecification> Specifications, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record ItemVariantSpecification(Guid Id, string Name, string Value, int SortOrder);
public sealed record ItemPriceAdjustment(Guid Id, Guid? VariantId, DateOnly EffectiveDate, decimal PreviousRawCost, decimal PreviousSellingPrice, decimal RawCost, decimal SellingPrice, string Reason, string Notes, DateTimeOffset CreatedAt, string CreatedBy);
public enum ItemStatus { Active, Inactive, Discontinued }
