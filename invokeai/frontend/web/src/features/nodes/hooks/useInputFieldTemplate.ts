import { useNodeTemplate } from 'features/nodes/hooks/useNodeTemplate';
import type { FieldInputTemplate } from 'features/nodes/types/field';
import { useMemo } from 'react';
import { assert } from 'tsafe';

/**
 * Returns the template for a specific input field of a node.
 *
 * **Note:** This hook will throw an error if the template for the input field is not found.
 *
 * @param nodeId - The ID of the node.
 * @param fieldName - The name of the input field.
 * @throws Will throw an error if the template for the input field is not found.
 */
export const useInputFieldTemplate = (nodeId: string, fieldName: string): FieldInputTemplate => {
  const template = useNodeTemplate(nodeId);
  const fieldTemplate = useMemo(() => {
    const _fieldTemplate = template.inputs[fieldName];
    assert(_fieldTemplate, `Template for input field ${fieldName} not found.`);
    return _fieldTemplate;
  }, [fieldName, template.inputs]);
  return fieldTemplate;
};
