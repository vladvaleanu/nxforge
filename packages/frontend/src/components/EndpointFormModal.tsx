/**
 * Endpoint Form Modal
 * Create/Edit endpoint configuration
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { endpointsApi, Endpoint, CreateEndpointData, ScrapingStep } from '../api/endpoints';
import { getErrorMessage } from '../utils/error.utils';
import { showError, showSuccess } from '../utils/toast.utils';

interface EndpointFormModalProps {
  endpoint?: Endpoint | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EndpointFormModal({ endpoint, onClose, onSuccess }: EndpointFormModalProps) {
  const isEditing = !!endpoint;

  const [formData, setFormData] = useState<CreateEndpointData>({
    name: endpoint?.name || '',
    ipAddress: endpoint?.ipAddress || '',
    type: endpoint?.type || 'power-meter',
    vendor: endpoint?.vendor || '',
    location: endpoint?.location || '',
    clientName: endpoint?.clientName || '',
    authType: endpoint?.authType || 'none',
    authConfig: endpoint?.authConfig || undefined,
    scrapingConfig: endpoint?.scrapingConfig || {
      steps: [{ action: 'navigate', url: '' }],
      valueSelector: '',
      valuePattern: '',
      timeout: 30000,
    },
    enabled: endpoint?.enabled ?? true,
    pollInterval: endpoint?.pollInterval || 15,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CreateEndpointData) => {
      if (isEditing && endpoint) {
        return endpointsApi.update(endpoint.id, data);
      } else {
        return endpointsApi.create(data);
      }
    },
    onSuccess: () => {
      showSuccess(isEditing ? 'Endpoint updated successfully' : 'Endpoint created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      showError(`Failed to save endpoint: ${getErrorMessage(error)}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveMutation.mutateAsync(formData);
  };

  const addScrapingStep = () => {
    setFormData({
      ...formData,
      scrapingConfig: {
        ...formData.scrapingConfig,
        steps: [...formData.scrapingConfig.steps, { action: 'navigate', url: '' }],
      },
    });
  };

  const removeScrapingStep = (index: number) => {
    setFormData({
      ...formData,
      scrapingConfig: {
        ...formData.scrapingConfig,
        steps: formData.scrapingConfig.steps.filter((_, i) => i !== index),
      },
    });
  };

  const updateScrapingStep = (index: number, step: Partial<ScrapingStep>) => {
    const newSteps = [...formData.scrapingConfig.steps];
    newSteps[index] = { ...newSteps[index], ...step };
    setFormData({
      ...formData,
      scrapingConfig: {
        ...formData.scrapingConfig,
        steps: newSteps,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Endpoint' : 'Add New Endpoint'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Rack 1 Power Meter"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="power-meter"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="APC, Schneider, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Room A, Rack 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Client XYZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Poll Interval (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.pollInterval}
                    onChange={(e) => setFormData({ ...formData, pollInterval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enabled
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Authentication */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Authentication
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Auth Type
                  </label>
                  <select
                    value={formData.authType}
                    onChange={(e) => setFormData({ ...formData, authType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic Auth</option>
                    <option value="form">Form Login</option>
                  </select>
                </div>

                {formData.authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.authConfig?.username || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          authConfig: { ...formData.authConfig, username: e.target.value },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        value={formData.authConfig?.password || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          authConfig: { ...formData.authConfig, password: e.target.value },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {formData.authType === 'form' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Username
                        </label>
                        <input
                          type="text"
                          value={formData.authConfig?.username || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            authConfig: { ...formData.authConfig, username: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="admin"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Password
                        </label>
                        <input
                          type="password"
                          value={formData.authConfig?.password || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            authConfig: { ...formData.authConfig, password: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Username Selector (CSS)
                        </label>
                        <input
                          type="text"
                          value={formData.authConfig?.usernameSelector || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            authConfig: { ...formData.authConfig, usernameSelector: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="input[name='username']"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Password Selector (CSS)
                        </label>
                        <input
                          type="text"
                          value={formData.authConfig?.passwordSelector || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            authConfig: { ...formData.authConfig, passwordSelector: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="input[name='password']"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Submit Button Selector (CSS)
                        </label>
                        <input
                          type="text"
                          value={formData.authConfig?.submitSelector || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            authConfig: { ...formData.authConfig, submitSelector: e.target.value },
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          placeholder="button[type='submit']"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      If selectors are left empty, default selectors will be used (input[name='username'], input[name='password'], button[type='submit'])
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Scraping Configuration */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Scraping Configuration
              </h3>

              {/* Steps */}
              <div className="space-y-3 mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Scraping Steps
                </label>
                {formData.scrapingConfig.steps.map((step, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <select
                        value={step.action}
                        onChange={(e) => updateScrapingStep(index, { action: e.target.value as any })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="navigate">Navigate</option>
                        <option value="click">Click</option>
                        <option value="type">Type</option>
                        <option value="wait">Wait</option>
                        <option value="select">Select</option>
                      </select>

                      {step.action === 'navigate' && (
                        <input
                          type="text"
                          placeholder="URL"
                          value={step.url || ''}
                          onChange={(e) => updateScrapingStep(index, { url: e.target.value })}
                          className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      )}

                      {(step.action === 'click' || step.action === 'type' || step.action === 'select') && (
                        <>
                          <input
                            type="text"
                            placeholder="CSS Selector"
                            value={step.selector || ''}
                            onChange={(e) => updateScrapingStep(index, { selector: e.target.value })}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                          {step.action === 'type' && (
                            <input
                              type="text"
                              placeholder="Value"
                              value={step.value || ''}
                              onChange={(e) => updateScrapingStep(index, { value: e.target.value })}
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          )}
                        </>
                      )}

                      {step.action === 'wait' && (
                        <input
                          type="number"
                          placeholder="Timeout (ms)"
                          value={step.timeout || 1000}
                          onChange={(e) => updateScrapingStep(index, { timeout: parseInt(e.target.value) })}
                          className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScrapingStep(index)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addScrapingStep}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  <Plus size={16} />
                  Add Step
                </button>
              </div>

              {/* Value Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Value Selector (CSS) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.scrapingConfig.valueSelector}
                    onChange={(e) => setFormData({
                      ...formData,
                      scrapingConfig: { ...formData.scrapingConfig, valueSelector: e.target.value },
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder=".kwh-value"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Value Pattern (Regex)
                  </label>
                  <input
                    type="text"
                    value={formData.scrapingConfig.valuePattern || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      scrapingConfig: { ...formData.scrapingConfig, valuePattern: e.target.value },
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="(\d+\.?\d*)"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Endpoint' : 'Create Endpoint'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
