namespace AdielSystem.Application.Suppliers;

public sealed record SupplierContactRequest(Guid? Id, string Name, string Email, string Phone);
public sealed record SupplierPerformanceNoteRequest(Guid? Id, string Text);
public sealed record SaveSupplierRequest(string Name, string? Logo, string Type, string Status, string Tin, string CompanyEmail, string CompanyPhone, string Address, string? CatalogUrl, IReadOnlyList<SupplierContactRequest> Contacts, IReadOnlyList<string> Categories, IReadOnlyList<SupplierPerformanceNoteRequest> PerformanceNotes, long? Version = null);
public sealed record SupplierContactDto(Guid Id, string Name, string Email, string Phone, bool IsPrimary, int SortOrder);
public sealed record SupplierPerformanceNoteDto(Guid Id, string Text);
public sealed record SupplierDto(Guid Id, string Logo, string Name, string Type, string Status, string Tin, string CompanyEmail, string CompanyPhone, string Address, string CatalogUrl, IReadOnlyList<SupplierContactDto> Contacts, IReadOnlyList<string> Categories, IReadOnlyList<SupplierPerformanceNoteDto> PerformanceNotes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
public sealed record ChangeSupplierArchiveRequest(long Version);
public sealed record SupplierDirectorySummaryDto(long TotalSuppliers, long ActiveSuppliers, long CategoryCount);
public sealed record SupplierPageDto(IReadOnlyList<SupplierDto> Items, int Page, int PageSize, long Total, SupplierDirectorySummaryDto Summary);
