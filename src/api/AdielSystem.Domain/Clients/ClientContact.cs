namespace AdielSystem.Domain.Clients;

public sealed record ClientContact(
    Guid Id,
    string Name,
    string Email,
    string Phone,
    bool IsPrimary,
    int SortOrder)
{
    public static ClientContact Create(
        Guid id,
        string name,
        string email,
        string phone,
        bool isPrimary,
        int sortOrder)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("A contact ID is required.", nameof(id));
        }

        var normalizedName = Required(name, nameof(name), 200);
        var normalizedEmail = Required(email, nameof(email), 320);
        var normalizedPhone = Required(phone, nameof(phone), 50);

        if (!System.Net.Mail.MailAddress.TryCreate(normalizedEmail, out _))
        {
            throw new ArgumentException("A valid contact email is required.", nameof(email));
        }

        if (sortOrder < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(sortOrder));
        }

        return new ClientContact(
            id,
            normalizedName,
            normalizedEmail,
            normalizedPhone,
            isPrimary,
            sortOrder);
    }

    private static string Required(string value, string parameterName, int maximumLength)
    {
        var normalized = value.Trim();
        if (normalized.Length is 0 || normalized.Length > maximumLength)
        {
            throw new ArgumentException(
                $"The value must be between 1 and {maximumLength} characters.",
                parameterName);
        }

        return normalized;
    }
}
