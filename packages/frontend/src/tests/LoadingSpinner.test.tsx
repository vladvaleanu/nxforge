import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('Rendering', () => {
    it('should render spinner', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render text by default', () => {
      const { container } = render(<LoadingSpinner />);

      const text = container.querySelector('p');
      expect(text).not.toBeInTheDocument();
    });

    it('should render with custom text', () => {
      render(<LoadingSpinner text="Please wait" />);

      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });

    it('should render without text when text prop is empty string', () => {
      render(<LoadingSpinner text="" />);

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      const { container } = render(<LoadingSpinner size="sm" />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('should render medium size (default)', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('should render large size', () => {
      const { container } = render(<LoadingSpinner size="lg" />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('should render extra large size', () => {
      const { container } = render(<LoadingSpinner size="xl" />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-16', 'w-16');
    });
  });

  describe('Animation', () => {
    it('should have animation class', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should have aria-label', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });
  });

  describe('Centering', () => {
    it('should center spinner by default', () => {
      const { container } = render(<LoadingSpinner />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('should accept custom className', () => {
      const { container } = render(<LoadingSpinner className="my-custom-class" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center', 'my-custom-class');
    });
  });

  describe('Full screen variant', () => {
    it('should render full screen spinner', () => {
      const { container } = render(<LoadingSpinner fullScreen />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed', 'inset-0');
    });

    it('should have proper background when full screen', () => {
      const { container } = render(<LoadingSpinner fullScreen />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('bg-gray-50');
    });

    it('should be centered when full screen', () => {
      const { container } = render(<LoadingSpinner fullScreen />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('Text styling', () => {
    it('should render text with proper styling', () => {
      const { container } = render(<LoadingSpinner text="Loading data" />);

      const text = container.querySelector('p');
      expect(text).toHaveClass('text-sm');
      expect(text).toHaveClass('mt-3');
    });

    it('should display custom text correctly', () => {
      render(<LoadingSpinner text="Processing..." />);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('Spinner styling', () => {
    it('should have rounded border', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('rounded-full');
    });

    it('should have border styling', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('border-2');
      expect(spinner).toHaveClass('border-b-blue-600');
    });

    it('should have dark mode support', () => {
      const { container } = render(<LoadingSpinner />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('dark:border-b-blue-400');
    });
  });

  describe('Container structure', () => {
    it('should wrap spinner in text-center div', () => {
      const { container } = render(<LoadingSpinner />);

      const textCenter = container.querySelector('.text-center');
      expect(textCenter).toBeInTheDocument();

      const spinner = textCenter?.querySelector('[role="status"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should maintain structure with full screen', () => {
      const { container } = render(<LoadingSpinner fullScreen />);

      const textCenter = container.querySelector('.text-center');
      expect(textCenter).toBeInTheDocument();
    });
  });

  describe('Props combination', () => {
    it('should handle size and text together', () => {
      const { container } = render(<LoadingSpinner size="lg" text="Loading..." />);

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-12', 'w-12');
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle fullScreen and text together', () => {
      const { container } = render(<LoadingSpinner fullScreen text="Please wait" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed', 'inset-0');
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });

    it('should handle all props together', () => {
      const { container } = render(
        <LoadingSpinner fullScreen size="xl" text="Processing" className="custom" />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed', 'inset-0');

      const spinner = container.querySelector('[role="status"]');
      expect(spinner).toHaveClass('h-16', 'w-16');

      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });
});
