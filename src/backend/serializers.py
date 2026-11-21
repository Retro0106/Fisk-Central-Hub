"""Plain functions that turn model instances into JSON-ready dicts."""


def course(c):
    return {"id": c.id, "code": c.code, "title": c.title}


def user_public(u):
    return {"id": u.id, "username": u.username, "name": u.name, "major": u.major, "class_year": u.class_year}


def user_private(u):
    data = user_public(u)
    data.update(
        {
            "email": u.email,
            "bio": u.bio,
            "email_verified": u.email_verified,
            "courses_taken": [course(c) for c in u.courses_taken.all()],
            "is_tutor": hasattr(u, "tutor_profile") and u.tutor_profile.is_active,
        }
    )
    return data


def listing(item, score=None):
    data = {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "price": float(item.price),
        "color": item.color,
        "condition": item.condition,
        "image": item.image,
        "is_sold": item.is_sold,
        "category": item.category.name if item.category_id else None,
        "seller": user_public(item.user),
        "created_at": item.created_at.isoformat(),
    }
    if score is not None:
        data["score"] = round(score, 4)
    return data


def tutor(t, score=None):
    data = {
        "id": t.id,
        "user": user_public(t.user),
        "bio": t.user.bio,
        "courses": [course(c) for c in t.courses.all()],
        "subjects": t.subjects,
        "availability": t.availability,
        "is_active": t.is_active,
    }
    if score is not None:
        data["score"] = round(score, 4)
    return data


def help_request(r):
    return {
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "course": course(r.course) if r.course_id else None,
        "subject_area": r.subject_area,
        "preferred_availability": r.preferred_availability,
        "status": r.status,
        "student": user_public(r.user),
        "created_at": r.created_at.isoformat(),
    }


def match(m, include_request=False):
    data = {
        "id": m.id,
        "score": round(m.score, 4),
        "reasons": m.reasons,
        "status": m.status,
        "tutor": tutor(m.tutor),
    }
    if include_request:
        data["request"] = help_request(m.request)
    return data


def organization(o, member_count=None):
    data = {
        "id": o.id,
        "name": o.name,
        "slug": o.slug,
        "description": o.description,
        "category": o.category,
        "category_label": o.get_category_display(),
        "contact_email": o.contact_email,
        "image": o.image,
    }
    if member_count is not None:
        data["member_count"] = member_count
    return data


def event(e, score=None):
    data = {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "location": e.location,
        "start_time": e.start_time.isoformat(),
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "organization": {"id": e.organization.id, "name": e.organization.name, "slug": e.organization.slug},
    }
    if score is not None:
        data["score"] = round(score, 4)
    return data


def message(m):
    return {"id": m.id, "sender_id": m.sender_id, "content": m.content, "sent_at": m.sent_at.isoformat()}
