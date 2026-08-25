namespace AdielSystem.Application.Clients;

public sealed record ClientContactRequest(Guid? Id, string Name, string Email, string Phone);
public sealed record SaveClientRequest(string Name, string? Photo, string Address, string Industry, DateOnly ClientSince, string Status, IReadOnlyList<ClientContactRequest> Contacts, long? Version = null);
public sealed record ClientContactDto(Guid Id, string Name, string Email, string Phone, bool IsPrimary, int SortOrder);
public sealed record ClientDto(Guid Id, string Photo, string Name, string ContactPerson, string Email, string Phone, string Address, string Industry, DateOnly ClientSince, string Status, IReadOnlyList<ClientContactDto> Contacts, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
public sealed record ChangeClientArchiveRequest(long Version);
public sealed record ClientDirectorySummaryDto(long TotalClients, long ActiveClients, long IndustryCount, decimal ApprovedSalesValue);
public sealed record ClientPageDto(IReadOnlyList<ClientDto> Items, int Page, int PageSize, long Total, ClientDirectorySummaryDto Summary);
public sealed record ClientTimelineEntryDto(Guid Id, string Kind, string Source, DateTimeOffset OccurredAt, string Reference, string Title, string Description, decimal? Amount, decimal? Balance, string Status, string Href);
public sealed record ClientTimelineSummaryDto(decimal SalesValue, decimal Collected, decimal Outstanding, int RecordCount, int OpenStatements, int PaymentCount);
public sealed record ClientTimelineDto(IReadOnlyList<ClientTimelineEntryDto> Items, ClientTimelineSummaryDto Summary);
public sealed record ClientIndustryDto(Guid Id, string Name, bool IsActive, int SortOrder, long UsageCount, long Version);
public sealed record CreateClientIndustryRequest(string Name);
public sealed record RenameClientIndustryRequest(string Name, long Version);
public sealed record SetClientIndustryActiveRequest(bool IsActive, long Version);
public sealed record ReorderClientIndustriesRequest(IReadOnlyList<Guid> Ids);
