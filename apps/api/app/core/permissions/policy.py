"""Action permission policy.

The model can propose anything; this policy decides what may run unattended.
"""

from __future__ import annotations

from enum import StrEnum


class Action(StrEnum):
    SEARCH_WEB = "search_web"
    READ_PAGE = "read_page"
    READ_DOCUMENT = "read_document"
    GENERATE_CV = "generate_cv"
    PREPARE_APPLICATION = "prepare_application"
    SUBMIT_APPLICATION = "submit_application"
    SEND_EMAIL = "send_email"
    DELETE_FILE = "delete_file"
    WRITE_FILE = "write_file"
    EXECUTE_SHELL = "execute_shell"
    ACCESS_ACCOUNT = "access_account"
    TERMINATE_PROCESS = "terminate_process"
    HTTP_REQUEST = "http_request"
    SEND_NOTIFICATION = "send_notification"


AUTOMATIC = {
    Action.SEARCH_WEB,
    Action.READ_PAGE,
    Action.READ_DOCUMENT,
    Action.GENERATE_CV,
    Action.PREPARE_APPLICATION,
    Action.SEND_NOTIFICATION,
}

APPROVAL = {
    Action.SUBMIT_APPLICATION,
    Action.SEND_EMAIL,
    Action.DELETE_FILE,
    Action.WRITE_FILE,
    Action.ACCESS_ACCOUNT,
    Action.TERMINATE_PROCESS,
    Action.HTTP_REQUEST,
}

RESTRICTED = {Action.EXECUTE_SHELL}


def decision(action: Action) -> str:
    if action in AUTOMATIC:
        return "auto"
    if action in APPROVAL:
        return "approval"
    if action in RESTRICTED:
        return "sandbox"
    return "approval"


def requires_approval(action: Action) -> bool:
    return decision(action) != "auto"
