import json
import math
import os
import tempfile


MEDIA_FIELDS = {
    "id": (int, float),
    "type": str,
    "title": str,
    "description": str,
    "rating": (int, float),
    "voteCount": (int, float),
    "popularity": (int, float),
    "releaseDate": str,
    "posterPath": str,
    "backdropPath": str,
    "mediaType": str,
    "genreTitle": str,
}


def normalize_media(record, media_type):
    return {
        "id": record.get("id"),
        "type": "tmdb",
        "title": record.get("title") or record.get("name") or "",
        "description": record.get("description") or record.get("overview") or "",
        "rating": record.get("rating", record.get("vote_average")) or 0,
        "voteCount": record.get("voteCount", record.get("vote_count")) or 0,
        "popularity": record.get("popularity") or 0,
        "releaseDate": record.get("releaseDate", record.get("release_date", record.get("first_air_date"))) or "",
        "posterPath": record.get("posterPath", record.get("poster_path")) or "",
        "backdropPath": record.get("backdropPath", record.get("backdrop_path")) or "",
        "mediaType": media_type,
        "genreTitle": record.get("genreTitle") or "",
    }


def _get_path(data, path_parts):
    value = data
    for path_part in path_parts:
        if not isinstance(value, dict):
            return None
        value = value.get(path_part)
    return value


def _collect_media_records(value, records):
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and "id" in item:
                records.append(item)
            else:
                _collect_media_records(item, records)
    elif isinstance(value, dict):
        for item in value.values():
            _collect_media_records(item, records)


def validate_data(data, required_collections=()):
    records = []
    _collect_media_records(data, records)
    if not records:
        raise RuntimeError("No media records were generated; the existing data file was preserved.")

    for index, record in enumerate(records, start=1):
        for field, expected_type in MEDIA_FIELDS.items():
            if not isinstance(record.get(field), expected_type):
                raise RuntimeError(f"Record {index}: field {field!r} has an invalid type.")
            if isinstance(record[field], (int, float)) and not math.isfinite(record[field]):
                raise RuntimeError(f"Record {index}: field {field!r} must be finite.")
        if record["type"] != "tmdb":
            raise RuntimeError(f"Record {index}: field 'type' must be 'tmdb'.")
        if record["mediaType"] not in ("movie", "tv"):
            raise RuntimeError(f"Record {index}: field 'mediaType' must be 'movie' or 'tv'.")

    for collection_path in required_collections:
        collection = _get_path(data, collection_path)
        if not isinstance(collection, list) or not collection:
            path_label = ".".join(collection_path)
            raise RuntimeError(f"Required collection {path_label!r} is empty; the existing data file was preserved.")

    return len(records)


def write_validated_json(output_file, data, label, required_collections=()):
    record_count = validate_data(data, required_collections)
    directory = os.path.dirname(output_file)
    os.makedirs(directory, exist_ok=True)

    descriptor, temporary_path = tempfile.mkstemp(prefix=f".{os.path.basename(output_file)}.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary_path, output_file)
    except Exception:
        if os.path.exists(temporary_path):
            os.unlink(temporary_path)
        raise

    print(f"[data] {label}: validated {record_count} media records and wrote {output_file}.")
    return record_count
