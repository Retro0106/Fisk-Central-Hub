from django.core.management.base import BaseCommand, CommandError

from backend import search


class Command(BaseCommand):
    help = (
        "Build the in-memory semantic search indexes and report their sizes. "
        "The server rebuilds indexes on its own after changes; use this to "
        "download the embedding model ahead of time or to try a query."
    )

    def add_arguments(self, parser):
        parser.add_argument("--type", default="all", choices=["all", *search.TYPE_NAMES])
        parser.add_argument("--query", help="Run a test query and print the top results.")
        parser.add_argument("--k", type=int, default=5)

    def handle(self, *args, **options):
        types = search.TYPE_NAMES if options["type"] == "all" else [options["type"]]
        try:
            for type_name in types:
                search.mark_dirty(type_name)
                _, ids, _ = search.ensure_built(type_name)
                self.stdout.write(f"{type_name}: {len(ids)} items indexed")
        except OSError as exc:
            raise CommandError(f"Couldn't load the embedding model: {exc}") from exc

        query = options.get("query")
        if not query:
            return
        from backend.views.search import LOADERS

        for type_name in types:
            ranked = search.search(type_name, query, k=options["k"], min_score=0)
            queryset, _ = LOADERS[type_name]
            objects = queryset.in_bulk([obj_id for obj_id, _ in ranked])
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{type_name} results for {query!r}"))
            for obj_id, score in ranked:
                self.stdout.write(f"  {score:.3f}  {objects.get(obj_id)}")
