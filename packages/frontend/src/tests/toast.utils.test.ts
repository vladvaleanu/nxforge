import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { showSuccess, showError, showWarning, showInfo } from '../utils/toast.utils';

describe('Toast Utils', () => {
  beforeEach(() => {
    // Clear any existing toasts from the container, but don't remove the container itself
    // This prevents the module-level toastContainer variable from becoming stale
    const existingContainer = document.getElementById('toast-container');
    if (existingContainer) {
      // Remove all child toasts
      while (existingContainer.firstChild) {
        existingContainer.removeChild(existingContainer.firstChild);
      }
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('showSuccess', () => {
    it('should create a success toast', () => {
      showSuccess('Operation successful');

      const container = document.getElementById('toast-container');
      expect(container).toBeTruthy();

      const toast = container?.querySelector('div');
      expect(toast).toBeTruthy();
      expect(toast?.innerHTML).toContain('Operation successful');
    });

    it('should show checkmark icon for success', () => {
      showSuccess('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast?.innerHTML).toContain('✓');
    });

    it('should auto-dismiss after default duration', () => {
      showSuccess('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast).toBeTruthy();

      // Fast-forward 4 seconds (default duration)
      vi.advanceTimersByTime(4000);

      // Animation starts
      vi.advanceTimersByTime(300);

      // Toast should be removed
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });

    it('should auto-dismiss after custom duration', () => {
      showSuccess('Test', 5000);

      let container = document.getElementById('toast-container');
      let toast = container?.querySelector('div');
      expect(toast).toBeTruthy();

      // Fast-forward 4 seconds
      vi.advanceTimersByTime(4000);
      toast = document.getElementById('toast-container')?.querySelector('div');
      expect(toast).toBeTruthy();

      // Fast-forward another 1 second + animation
      vi.advanceTimersByTime(1300);
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });
  });

  describe('showError', () => {
    it('should create an error toast', () => {
      showError('Something went wrong');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast).toBeTruthy();
      expect(toast?.innerHTML).toContain('Something went wrong');
    });

    it('should show X icon for error', () => {
      showError('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast?.innerHTML).toContain('✕');
    });

    it('should use longer default duration for errors', () => {
      showError('Test');

      const container = document.getElementById('toast-container');
      let toast = container?.querySelector('div');

      // Should still be there after 4 seconds
      vi.advanceTimersByTime(4000);
      toast = document.getElementById('toast-container')?.querySelector('div');
      expect(toast).toBeTruthy();

      // Should dismiss after 6 seconds + animation
      vi.advanceTimersByTime(2300);
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });
  });

  describe('showWarning', () => {
    it('should create a warning toast', () => {
      showWarning('Please be careful');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast).toBeTruthy();
      expect(toast?.innerHTML).toContain('Please be careful');
    });

    it('should show warning icon', () => {
      showWarning('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast?.innerHTML).toContain('⚠');
    });
  });

  describe('showInfo', () => {
    it('should create an info toast', () => {
      showInfo('For your information');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast).toBeTruthy();
      expect(toast?.innerHTML).toContain('For your information');
    });

    it('should show info icon', () => {
      showInfo('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      expect(toast?.innerHTML).toContain('ⓘ');
    });
  });

  describe('Multiple toasts', () => {
    it('should stack multiple toasts vertically', () => {
      showSuccess('First');
      showError('Second');
      showWarning('Third');

      const toasts = document.querySelectorAll('#toast-container > div');
      expect(toasts.length).toBe(3);
    });

    it('should dismiss toasts independently', () => {
      showSuccess('First', 1000);
      showSuccess('Second', 2000);

      // Fast-forward 1 second + animation
      vi.advanceTimersByTime(1300);

      let toasts = document.querySelectorAll('#toast-container > div');
      expect(toasts.length).toBe(1);
      expect(toasts[0].innerHTML).toContain('Second');

      // Fast-forward another second + animation
      vi.advanceTimersByTime(1000);

      toasts = document.querySelectorAll('#toast-container > div');
      expect(toasts.length).toBe(0);
    });
  });

  describe('Close button', () => {
    it('should have a close button', () => {
      showSuccess('Test');

      const container = document.getElementById('toast-container');
      const closeButton = container?.querySelector('button');
      expect(closeButton).toBeTruthy();
      expect(closeButton?.textContent).toBe('×');
    });

    it('should close toast when close button is clicked', () => {
      showSuccess('Test');

      const container = document.getElementById('toast-container');
      const toast = container?.querySelector('div');
      const closeButton = toast?.querySelector('button');

      closeButton?.click();

      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });
  });

  describe('Toast container', () => {
    it('should create a toast container', () => {
      showSuccess('Test');

      const container = document.getElementById('toast-container');
      expect(container).toBeTruthy();
    });

    it('should reuse existing toast container', () => {
      showSuccess('First');
      showSuccess('Second');

      const containers = document.querySelectorAll('#toast-container');
      expect(containers.length).toBe(1);
    });

    it('should remove container when all toasts are dismissed', () => {
      showSuccess('Test', 100);

      expect(document.getElementById('toast-container')).toBeTruthy();

      // Fast-forward to dismiss toast
      vi.advanceTimersByTime(400);

      expect(document.getElementById('toast-container')).toBeFalsy();
    });
  });

  describe('Custom duration', () => {
    it('should respect custom duration for success', () => {
      showSuccess('Test', 1000);

      let container = document.getElementById('toast-container');
      let toast = container?.querySelector('div');

      vi.advanceTimersByTime(900);
      toast = document.getElementById('toast-container')?.querySelector('div');
      expect(toast).toBeTruthy();

      vi.advanceTimersByTime(400);
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });

    it('should respect custom duration for error', () => {
      showError('Test', 2000);

      let container = document.getElementById('toast-container');
      let toast = container?.querySelector('div');

      vi.advanceTimersByTime(1900);
      toast = document.getElementById('toast-container')?.querySelector('div');
      expect(toast).toBeTruthy();

      vi.advanceTimersByTime(400);
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeFalsy();
    });

    it('should not auto-dismiss when duration is 0', () => {
      showSuccess('Test', 0);

      // Verify toast exists initially
      const container = document.getElementById('toast-container');
      expect(container?.querySelector('div')).toBeTruthy();

      // Fast-forward time - toast should still be there
      vi.advanceTimersByTime(10000);
      const remainingToast = document.getElementById('toast-container')?.querySelector('div');
      expect(remainingToast).toBeTruthy();
    });
  });
});
