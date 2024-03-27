from dynaconf import Validator, Dynaconf

settings = Dynaconf(
    includes=["config/*.toml"],
    settings_files=["config/settings.toml"],
    envvar_prefix="APP",
    environments=True,
    load_dotenv=True,
    env_switcher="ENV",
    validators=[
        Validator(
            "LOG_LEVEL", must_exist=True, default="INFO", is_in={"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        ),
    ],
)