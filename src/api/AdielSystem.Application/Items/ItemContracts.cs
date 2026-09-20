namespace AdielSystem.Application.Items;

public sealed record SaveItemRequest(Guid? SupplierId, string Name, string? Photo, string Category, string? Subcategory, string? Brand, string UnitOfMeasure, decimal UnitWeight, string? ProductCode, string? Barcode, string? Description, string Status, decimal RawCost, decimal SellingPrice, DateOnly? LastPriceUpdate, long? Version = null);
public sealed record SaveItemVariantSpecificationRequest(Guid? Id, string Name, string Value);
public sealed record SaveItemVariantRequest(Guid? SupplierId, string Name, string Value, string? Photo, string? ProductCode, string? Barcode, string UnitOfMeasure, decimal UnitWeight, string Status, decimal RawCost, decimal SellingPrice, IReadOnlyList<SaveItemVariantSpecificationRequest> Specifications, long? Version = null);
public sealed record AddPriceAdjustmentRequest(Guid? VariantId, decimal RawCost, decimal SellingPrice, DateOnly EffectiveDate, string Reason, string? Notes, long ItemVersion, long? VariantVersion = null);
public sealed record ChangeItemArchiveRequest(long Version);
public sealed record ItemVariantSpecificationDto(Guid Id, string Name, string Value, int SortOrder);
public sealed record ItemVariantDto(Guid Id, Guid? SupplierId, string Name, string Value, string Photo, string ProductCode, string Barcode, string UnitOfMeasure, decimal UnitWeight, string Status, decimal RawCost, decimal SellingPrice, int SortOrder, IReadOnlyList<ItemVariantSpecificationDto> Specifications, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record ItemPriceAdjustmentDto(Guid Id, Guid? VariantId, DateOnly EffectiveDate, decimal PreviousRawCost, decimal PreviousSellingPrice, decimal RawCost, decimal SellingPrice, string Reason, string Notes, DateTimeOffset CreatedAt, string CreatedBy);
public sealed record ItemDto(Guid Id, Guid? SupplierId, string Name, string Photo, string Category, string Subcategory, string Brand, string UnitOfMeasure, decimal UnitWeight, string ProductCode, string Barcode, string Description, string Status, decimal RawCost, decimal SellingPrice, DateOnly? LastPriceUpdate, IReadOnlyList<ItemVariantDto> Variants, IReadOnlyList<ItemPriceAdjustmentDto> PriceAdjustments, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
public sealed record ItemDirectorySummaryDto(long TotalItems, long ActiveItems, long CategoryCount, decimal AverageMargin);
public sealed record ItemPageDto(IReadOnlyList<ItemDto> Items, int Page, int PageSize, long Total, ItemDirectorySummaryDto Summary);
