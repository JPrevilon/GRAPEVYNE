from flask import jsonify


def success_response(data=None, message=None, status=200):
    body = {"data": data if data is not None else {}}

    if message:
        body["message"] = message

    return jsonify(body), status


def error_response(message, status=400, code="bad_request", details=None):
    error = {
        "code": code,
        "message": message,
    }

    if details:
        error["details"] = details

    return jsonify({"error": error}), status

