import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConfirm } from '../hooks/useConfirm';

describe('useConfirm', () => {
  describe('Initial state', () => {
    it('should have closed state initially', () => {
      const { result } = renderHook(() => useConfirm());

      expect(result.current.confirmState.isOpen).toBe(false);
      expect(result.current.confirmState.isLoading).toBe(false);
    });

    it('should have default values', () => {
      const { result } = renderHook(() => useConfirm());

      expect(result.current.confirmState.title).toBe('');
      expect(result.current.confirmState.message).toBe('');
      expect(result.current.confirmState.confirmText).toBe('Confirm');
      expect(result.current.confirmState.cancelText).toBe('Cancel');
      expect(result.current.confirmState.variant).toBe('danger');
    });
  });

  describe('confirm function', () => {
    it('should open modal with provided options', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Delete Item',
          message: 'Are you sure?',
          variant: 'danger',
        });
      });

      expect(result.current.confirmState.isOpen).toBe(true);
      expect(result.current.confirmState.title).toBe('Delete Item');
      expect(result.current.confirmState.message).toBe('Are you sure?');
      expect(result.current.confirmState.variant).toBe('danger');
    });

    it('should store the action function', () => {
      const { result } = renderHook(() => useConfirm());
      const action = vi.fn(() => Promise.resolve());

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test message',
        });
      });

      expect(result.current.confirmState.isOpen).toBe(true);
      expect(typeof result.current.confirmState.onConfirm).toBe('function');
    });

    it('should use custom confirm text', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
          confirmText: 'Delete Forever',
        });
      });

      expect(result.current.confirmState.confirmText).toBe('Delete Forever');
    });

    it('should use custom cancel text', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
          cancelText: 'Go Back',
        });
      });

      expect(result.current.confirmState.cancelText).toBe('Go Back');
    });
  });

  describe('handleConfirm', () => {
    it('should execute action when confirmed', async () => {
      const { result } = renderHook(() => useConfirm());
      const action = vi.fn(() => Promise.resolve());

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(action).toHaveBeenCalledOnce();
    });

    it('should set loading state during action execution', async () => {
      const { result } = renderHook(() => useConfirm());
      let resolveAction: () => void;
      const action = () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        });

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      // Start the confirmation (don't await yet so we can check intermediate state)
      let confirmPromise: Promise<void>;
      act(() => {
        confirmPromise = result.current.handleConfirm();
      });

      // Wait a bit for loading state to be set
      await waitFor(() => {
        expect(result.current.confirmState.isLoading).toBe(true);
      });

      // Resolve the action and wait for completion
      resolveAction!();
      await act(async () => {
        await confirmPromise!;
      });

      // Should no longer be loading
      expect(result.current.confirmState.isLoading).toBe(false);
    });

    it('should close modal after successful action', async () => {
      const { result } = renderHook(() => useConfirm());
      const action = vi.fn(() => Promise.resolve());

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(result.current.confirmState.isOpen).toBe(false);
    });

    it('should handle action errors gracefully', async () => {
      const { result } = renderHook(() => useConfirm());
      const error = new Error('Action failed');
      const action = vi.fn(() => Promise.reject(error));

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      await expect(
        act(async () => {
          await result.current.handleConfirm();
        })
      ).rejects.toThrow('Action failed');

      // Should still be open and not loading after error
      expect(result.current.confirmState.isOpen).toBe(true);
      expect(result.current.confirmState.isLoading).toBe(false);
    });

    it('should re-throw errors for handling', async () => {
      const { result } = renderHook(() => useConfirm());
      const error = new Error('Action failed');
      const action = vi.fn(() => Promise.reject(error));

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      await expect(
        act(async () => {
          await result.current.handleConfirm();
        })
      ).rejects.toThrow('Action failed');
    });
  });

  describe('handleClose', () => {
    it('should close modal', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
        });
      });

      expect(result.current.confirmState.isOpen).toBe(true);

      act(() => {
        result.current.handleClose();
      });

      expect(result.current.confirmState.isOpen).toBe(false);
    });

    it('should not close modal while loading', async () => {
      const { result } = renderHook(() => useConfirm());
      let resolveAction: () => void;
      const action = () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        });

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      // Start confirmation (this sets loading to true)
      let confirmPromise: Promise<void>;
      act(() => {
        confirmPromise = result.current.handleConfirm();
      });

      // Wait for loading state
      await waitFor(() => {
        expect(result.current.confirmState.isLoading).toBe(true);
      });

      // Try to close while loading
      act(() => {
        result.current.handleClose();
      });

      // Should still be open
      expect(result.current.confirmState.isOpen).toBe(true);

      // Resolve and finish
      resolveAction!();
      await act(async () => {
        await confirmPromise!;
      });
    });
  });

  describe('Multiple confirmations', () => {
    it('should handle sequential confirmations', async () => {
      const { result } = renderHook(() => useConfirm());
      const action1 = vi.fn(() => Promise.resolve());
      const action2 = vi.fn(() => Promise.resolve());

      // First confirmation
      act(() => {
        result.current.confirm(action1, {
          title: 'First',
          message: 'First message',
        });
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(action1).toHaveBeenCalledOnce();

      // Second confirmation
      act(() => {
        result.current.confirm(action2, {
          title: 'Second',
          message: 'Second message',
        });
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(action2).toHaveBeenCalledOnce();
    });

    it('should replace previous confirmation if new one is triggered', () => {
      const { result } = renderHook(() => useConfirm());
      const action1 = vi.fn(() => Promise.resolve());
      const action2 = vi.fn(() => Promise.resolve());

      act(() => {
        result.current.confirm(action1, {
          title: 'First',
          message: 'First message',
        });
      });

      act(() => {
        result.current.confirm(action2, {
          title: 'Second',
          message: 'Second message',
        });
      });

      expect(result.current.confirmState.title).toBe('Second');
      expect(result.current.confirmState.message).toBe('Second message');
    });
  });

  describe('Variant types', () => {
    it('should support danger variant', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
          variant: 'danger',
        });
      });

      expect(result.current.confirmState.variant).toBe('danger');
    });

    it('should support warning variant', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
          variant: 'warning',
        });
      });

      expect(result.current.confirmState.variant).toBe('warning');
    });

    it('should support info variant', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: 'Test',
          variant: 'info',
        });
      });

      expect(result.current.confirmState.variant).toBe('info');
    });
  });

  describe('Synchronous actions', () => {
    it('should handle synchronous void actions', async () => {
      const { result } = renderHook(() => useConfirm());
      const action = vi.fn();

      act(() => {
        result.current.confirm(action, {
          title: 'Test',
          message: 'Test',
        });
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(action).toHaveBeenCalledOnce();
      expect(result.current.confirmState.isOpen).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty title and message', () => {
      const { result } = renderHook(() => useConfirm());

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: '',
          message: '',
        });
      });

      expect(result.current.confirmState.title).toBe('');
      expect(result.current.confirmState.message).toBe('');
      expect(result.current.confirmState.isOpen).toBe(true);
    });

    it('should handle very long messages', () => {
      const { result } = renderHook(() => useConfirm());
      const longMessage = 'A'.repeat(1000);

      act(() => {
        result.current.confirm(() => Promise.resolve(), {
          title: 'Test',
          message: longMessage,
        });
      });

      expect(result.current.confirmState.message).toBe(longMessage);
    });
  });
});
