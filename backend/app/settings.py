from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    ai_provider: str = "ollama"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3:4b"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"
    gmail_token_encryption_key: str = ""
    oauth_state_secret: str = ""
    frontend_url: str = "http://localhost:3000"
    model_config = SettingsConfigDict(
        env_file=(".env.local", "../.env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [self.frontend_url, "http://localhost:3000"]

settings = Settings()
