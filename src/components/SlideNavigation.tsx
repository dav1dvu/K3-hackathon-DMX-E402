import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type SlideNavigationProps = {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function SlideNavigation({ currentPage, totalPages, onPrevious, onNext }: SlideNavigationProps) {
  return (
    <nav className="slide-navigation" aria-label="Điều hướng PDF">
      <button type="button" className="nav-button" onClick={onPrevious} disabled={totalPages === 0 || currentPage === 1} aria-label="Trang trước">
        <ChevronLeftIcon /><span>Previous</span>
      </button>
      <div className="page-indicator" aria-live="polite"><strong>{currentPage}</strong><span>/ {totalPages}</span></div>
      <button type="button" className="nav-button" onClick={onNext} disabled={totalPages === 0 || currentPage === totalPages} aria-label="Trang tiếp theo">
        <span>Next</span><ChevronRightIcon />
      </button>
    </nav>
  );
}
