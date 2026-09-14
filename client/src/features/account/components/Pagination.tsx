import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@bmd/shared';
import { Button } from '@/components/ui/Button';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 text-sm"
    >
      <p className="text-ink-600">
        Page {meta.page} of {meta.totalPages} · {meta.total} in total
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          leftIcon={<ChevronLeft aria-hidden className="size-4" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          rightIcon={<ChevronRight aria-hidden className="size-4" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
