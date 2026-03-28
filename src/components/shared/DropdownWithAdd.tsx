import React, { useState } from 'react';

interface DropdownWithAddProps {
  label: string;
  value: string;
  options: readonly string[] | string[];
  customOptions?: string[];
  onChange: (value: string) => void;
  onAddCustom?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const ADD_NEW_VALUE = '__add_new__';

export default function DropdownWithAdd({
  label,
  value,
  options,
  customOptions = [],
  onChange,
  onAddCustom,
  placeholder = 'Select...',
  required = false,
  className = '',
  disabled = false,
}: DropdownWithAddProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const allOptions = [...options, ...customOptions.filter((c) => !options.includes(c))];

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    if (selected === ADD_NEW_VALUE) {
      setIsAdding(true);
      setNewValue('');
    } else {
      onChange(selected);
    }
  }

  function handleAddSubmit() {
    const trimmed = newValue.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCustom?.(trimmed);
    onChange(trimmed);
    setIsAdding(false);
    setNewValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubmit();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewValue('');
    }
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`New ${label.toLowerCase()}...`}
            autoFocus
            className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddSubmit}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewValue('');
            }}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={handleSelectChange}
          required={required}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">{placeholder}</option>
          {allOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          {onAddCustom && (
            <option value={ADD_NEW_VALUE} className="text-blue-600 font-medium">
              + Add new...
            </option>
          )}
        </select>
      )}
    </div>
  );
}
