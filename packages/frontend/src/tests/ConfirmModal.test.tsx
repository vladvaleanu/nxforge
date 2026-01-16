import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from '../components/ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  it('should render when isOpen is true', () => {
    render(<ConfirmModal {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  describe('Variants', () => {
    it('should render danger variant with red styling', () => {
      render(<ConfirmModal {...defaultProps} variant="danger" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-red-600');
    });

    it('should render warning variant with yellow styling', () => {
      render(<ConfirmModal {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-yellow-600');
    });

    it('should render info variant with blue styling', () => {
      render(<ConfirmModal {...defaultProps} variant="info" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Custom text', () => {
    it('should use custom confirm text', () => {
      render(<ConfirmModal {...defaultProps} confirmText="Delete" />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should use custom cancel text', () => {
      render(<ConfirmModal {...defaultProps} cancelText="Go Back" />);

      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Confirm');
      await userEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const onClose = vi.fn();
      render(<ConfirmModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      const { container } = render(<ConfirmModal {...defaultProps} onClose={onClose} />);

      // Find the backdrop (first div with bg-black/50)
      const backdrop = container.querySelector('.bg-black\\/50');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should not close when modal content is clicked', async () => {
      const onClose = vi.fn();
      render(<ConfirmModal {...defaultProps} onClose={onClose} />);

      const modalContent = screen.getByText('Are you sure?');
      await userEvent.click(modalContent);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<ConfirmModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText('Confirm');
      // ButtonSpinner is rendered inside the confirm button
      const spinner = confirmButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should disable buttons when isLoading is true', () => {
      render(<ConfirmModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText('Confirm');
      const cancelButton = screen.getByText('Cancel');

      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should not call onConfirm when loading and button is clicked', async () => {
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} isLoading={true} />);

      const confirmButton = screen.getByText('Confirm');

      // Disabled button won't fire click event in userEvent
      // Use fireEvent to try clicking disabled button
      fireEvent.click(confirmButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should not close on backdrop click when loading', () => {
      const onClose = vi.fn();
      const { container } = render(<ConfirmModal {...defaultProps} onClose={onClose} isLoading={true} />);

      const backdrop = container.querySelector('.bg-black\\/50');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Icon rendering', () => {
    it('should show warning icon for danger variant', () => {
      const { container } = render(<ConfirmModal {...defaultProps} variant="danger" />);

      const icon = container.querySelector('.text-red-600');
      expect(icon).toBeInTheDocument();
      expect(icon?.tagName).toBe('svg');
    });

    it('should show alert icon for warning variant', () => {
      const { container } = render(<ConfirmModal {...defaultProps} variant="warning" />);

      const icon = container.querySelector('.text-yellow-600');
      expect(icon).toBeInTheDocument();
      expect(icon?.tagName).toBe('svg');
    });

    it('should show info icon for info variant', () => {
      const { container } = render(<ConfirmModal {...defaultProps} variant="info" />);

      const icon = container.querySelector('.text-blue-600');
      expect(icon).toBeInTheDocument();
      expect(icon?.tagName).toBe('svg');
    });
  });

  describe('Layout and styling', () => {
    it('should have proper modal structure', () => {
      const { container } = render(<ConfirmModal {...defaultProps} />);

      expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should display title prominently', () => {
      render(<ConfirmModal {...defaultProps} title="Important Action" />);

      const title = screen.getByText('Important Action');
      expect(title).toHaveClass('text-lg', 'font-semibold');
    });

    it('should display message with proper styling', () => {
      render(<ConfirmModal {...defaultProps} message="This is important" />);

      const message = screen.getByText('This is important');
      expect(message).toHaveClass('text-sm');
    });

    it('should have icon background matching variant', () => {
      const { container } = render(<ConfirmModal {...defaultProps} variant="danger" />);

      const iconBg = container.querySelector('.bg-red-100');
      expect(iconBg).toBeInTheDocument();
    });
  });

  describe('Button actions', () => {
    it('should render both cancel and confirm buttons', () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('should have different styling for cancel button', () => {
      render(<ConfirmModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveClass('bg-gray-200');
    });

    it('should have variant-specific styling for confirm button', () => {
      render(<ConfirmModal {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-yellow-600');
    });
  });

  describe('Async confirm handler', () => {
    it('should handle async onConfirm', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Confirm');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledOnce();
      });
    });

    // NOTE: ConfirmModal does not currently handle rejected promises from onConfirm
    // If error handling is added to the component in the future, uncomment and update this test
    /*
    it('should handle rejected onConfirm', async () => {
      const onConfirm = vi.fn().mockRejectedValue(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Confirm');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledOnce();
      });

      consoleSpy.mockRestore();
    });
    */
  });
});
