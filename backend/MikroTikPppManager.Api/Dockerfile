# ASP.NET Core (.NET 10) Backend Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src
COPY ["MikroTikPppManager.Api.csproj", "./"]
RUN dotnet restore "MikroTikPppManager.Api.csproj"
COPY . .
RUN dotnet publish "MikroTikPppManager.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MikroTikPppManager.Api.dll"]
