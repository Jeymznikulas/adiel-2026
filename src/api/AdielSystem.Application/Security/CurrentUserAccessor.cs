namespace AdielSystem.Application.Security;

public sealed record CurrentUser(Guid Id, string Username);

public interface ICurrentUserAccessor
{
    CurrentUser GetRequiredUser();
}
