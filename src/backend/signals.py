from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from . import search
from .models import Account, Category, Course, Event, Listing, Organization, TutorProfile

# Which search indexes each model's text feeds into.
AFFECTS = {
    Listing: ["listing"],
    Category: ["listing"],
    TutorProfile: ["tutor"],
    Account: ["tutor"],
    Course: ["tutor"],
    Organization: ["organization", "event"],
    Event: ["event"],
}


def _mark(sender, **kwargs):
    for type_name in AFFECTS.get(sender, []):
        search.mark_dirty(type_name)


for model in AFFECTS:
    post_save.connect(_mark, sender=model, dispatch_uid=f"search-save-{model.__name__}")
    post_delete.connect(_mark, sender=model, dispatch_uid=f"search-delete-{model.__name__}")


@receiver(m2m_changed, sender=TutorProfile.courses.through, dispatch_uid="search-tutor-courses")
def _tutor_courses_changed(**kwargs):
    search.mark_dirty("tutor")
