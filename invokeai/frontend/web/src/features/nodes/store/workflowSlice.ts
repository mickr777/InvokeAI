import type { PayloadAction, Selector } from '@reduxjs/toolkit';
import { createSelector, createSlice } from '@reduxjs/toolkit';
import type { PersistConfig, RootState } from 'app/store/store';
import { useAppSelector } from 'app/store/storeHooks';
import { deepClone } from 'common/util/deepClone';
import { workflowLoaded } from 'features/nodes/store/actions';
import { isAnyNodeOrEdgeMutation, nodeEditorReset, nodesChanged } from 'features/nodes/store/nodesSlice';
import type {
  FieldIdentifierWithValue,
  WorkflowMode,
  WorkflowsState as WorkflowState,
} from 'features/nodes/store/types';
import type { FieldIdentifier } from 'features/nodes/types/field';
import { isInvocationNode } from 'features/nodes/types/invocation';
import type {
  ContainerElement,
  FormElement,
  HeadingElement,
  NodeFieldElement,
  TextElement,
  WorkflowCategory,
  WorkflowV3,
} from 'features/nodes/types/workflow';
import { isContainerElement, isHeadingElement, isNodeFieldElement, isTextElement } from 'features/nodes/types/workflow';
import { isEqual, omit, uniqBy } from 'lodash-es';
import { useMemo } from 'react';
import type { SQLiteDirection, WorkflowRecordOrderBy } from 'services/api/types';

import { selectNodesSlice } from './selectors';

type FormElementDataChangedAction<T extends FormElement> = PayloadAction<{
  id: string;
  changes: Partial<T['data']>;
}>;

const formElementDataChangedReducer = <T extends FormElement>(
  state: WorkflowState,
  action: FormElementDataChangedAction<T>,
  guard: (element: FormElement) => element is T
) => {
  const { id, changes } = action.payload;
  const element = state.form?.elements[id];
  if (!element || !guard(element)) {
    return;
  }
  element.data = { ...element.data, ...changes } as T['data'];
};

const getBlankWorkflow = (): Omit<WorkflowV3, 'nodes' | 'edges'> => {
  return {
    name: '',
    author: '',
    description: '',
    version: '',
    contact: '',
    tags: '',
    notes: '',
    exposedFields: [],
    meta: { version: '3.0.0', category: 'user' },
    id: undefined,
    form: {
      elements: {},
      layout: [],
    },
  };
};

const initialWorkflowState: WorkflowState = {
  _version: 1,
  isTouched: false,
  mode: 'view',
  originalExposedFieldValues: [],
  searchTerm: '',
  orderBy: undefined, // initial value is decided in component
  orderDirection: 'DESC',
  categorySections: {},
  formMode: 'view',
  ...getBlankWorkflow(),
};

export const workflowSlice = createSlice({
  name: 'workflow',
  initialState: initialWorkflowState,
  reducers: {
    workflowModeChanged: (state, action: PayloadAction<WorkflowMode>) => {
      state.mode = action.payload;
    },
    workflowSearchTermChanged: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    workflowOrderByChanged: (state, action: PayloadAction<WorkflowRecordOrderBy>) => {
      state.orderBy = action.payload;
    },
    workflowOrderDirectionChanged: (state, action: PayloadAction<SQLiteDirection>) => {
      state.orderDirection = action.payload;
    },
    categorySectionsChanged: (state, action: PayloadAction<{ id: string; isOpen: boolean }>) => {
      const { id, isOpen } = action.payload;
      state.categorySections[id] = isOpen;
    },
    workflowExposedFieldAdded: (state, action: PayloadAction<FieldIdentifierWithValue>) => {
      state.exposedFields = uniqBy(
        state.exposedFields.concat(omit(action.payload, 'value')),
        (field) => `${field.nodeId}-${field.fieldName}`
      );
      state.originalExposedFieldValues = uniqBy(
        state.originalExposedFieldValues.concat(action.payload),
        (field) => `${field.nodeId}-${field.fieldName}`
      );
      state.isTouched = true;
    },
    workflowExposedFieldRemoved: (state, action: PayloadAction<FieldIdentifier>) => {
      state.exposedFields = state.exposedFields.filter((field) => !isEqual(field, action.payload));
      state.originalExposedFieldValues = state.originalExposedFieldValues.filter(
        (field) => !isEqual(omit(field, 'value'), action.payload)
      );
      state.isTouched = true;
    },
    workflowExposedFieldsReordered: (state, action: PayloadAction<FieldIdentifier[]>) => {
      state.exposedFields = action.payload;
      state.isTouched = true;
    },
    workflowNameChanged: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
      state.isTouched = true;
    },
    workflowCategoryChanged: (state, action: PayloadAction<WorkflowCategory | undefined>) => {
      if (action.payload) {
        state.meta.category = action.payload;
      }
    },
    workflowDescriptionChanged: (state, action: PayloadAction<string>) => {
      state.description = action.payload;
      state.isTouched = true;
    },
    workflowTagsChanged: (state, action: PayloadAction<string>) => {
      state.tags = action.payload;
      state.isTouched = true;
    },
    workflowAuthorChanged: (state, action: PayloadAction<string>) => {
      state.author = action.payload;
      state.isTouched = true;
    },
    workflowNotesChanged: (state, action: PayloadAction<string>) => {
      state.notes = action.payload;
      state.isTouched = true;
    },
    workflowVersionChanged: (state, action: PayloadAction<string>) => {
      state.version = action.payload;
      state.isTouched = true;
    },
    workflowContactChanged: (state, action: PayloadAction<string>) => {
      state.contact = action.payload;
      state.isTouched = true;
    },
    workflowIDChanged: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
    workflowSaved: (state) => {
      state.isTouched = false;
    },
    formReset: (state) => {
      state.form = {
        elements: {},
        layout: [],
      };
    },
    formElementAdded: (
      state,
      action: PayloadAction<{ element: FormElement; containerId?: string; index?: number }>
    ) => {
      if (!state.form) {
        // Cannot add an element if the form has not been created
        return;
      }
      const { element, containerId, index } = action.payload;
      addElement({ formState: state.form, element, containerId, index });
    },
    formElementRemoved: (state, action: PayloadAction<{ id: string }>) => {
      if (!state.form) {
        // Cannot remove an element if the form has not been created
        return;
      }
      const { id } = action.payload;
      removeElement({ id, formState: state.form });
    },
    formRootReordered: (state, action: PayloadAction<{ layout: string[] }>) => {
      const { layout } = action.payload;
      state.form.layout = layout;
    },
    formContainerChildrenReordered: (state, action: PayloadAction<{ containerId: string; children: string[] }>) => {
      const { containerId, children } = action.payload;
      const container = state.form.elements[containerId];
      if (!container || !isContainerElement(container)) {
        return;
      }
      container.data.children = children;
    },
    // formElementMoved: (state, action: PayloadAction<{ id: string; containerId?: string; index?: number }>) => {
    //   if (!state.form) {
    //     // Cannot remove an element if the form has not been created
    //     return;
    //   }
    //   const { id, containerId, index } = action.payload;
    //   moveElement({ formState: state.form, id, containerId, index });
    // },
    formElementReparented: (state, action: PayloadAction<{ id: string; containerId?: string; index?: number }>) => {
      if (!state.form) {
        // Cannot remove an element if the form has not been created
        return;
      }
      const { id, containerId, index } = action.payload;
      reparentElement({ formState: state.form, id, containerId, index });
    },
    formElementHeadingDataChanged: (state, action: FormElementDataChangedAction<HeadingElement>) => {
      formElementDataChangedReducer(state, action, isHeadingElement);
    },
    formElementTextDataChanged: (state, action: FormElementDataChangedAction<TextElement>) => {
      formElementDataChangedReducer(state, action, isTextElement);
    },
    formElementNodeFieldDataChanged: (state, action: FormElementDataChangedAction<NodeFieldElement>) => {
      formElementDataChangedReducer(state, action, isNodeFieldElement);
    },
    formElementContainerDataChanged: (state, action: FormElementDataChangedAction<ContainerElement>) => {
      formElementDataChangedReducer(state, action, isContainerElement);
    },
    formModeChanged: (state, action: PayloadAction<{ mode: 'view' | 'edit' }>) => {
      const { mode } = action.payload;
      state.formMode = mode;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(workflowLoaded, (state, action) => {
      const { nodes, edges: _edges, ...workflowExtra } = action.payload;

      const originalExposedFieldValues: FieldIdentifierWithValue[] = [];

      workflowExtra.exposedFields.forEach((field) => {
        const node = nodes.find((n) => n.id === field.nodeId);

        if (!isInvocationNode(node)) {
          return;
        }

        const input = node.data.inputs[field.fieldName];

        if (!input) {
          return;
        }

        const originalExposedFieldValue = {
          nodeId: field.nodeId,
          fieldName: field.fieldName,
          value: input.value,
        };
        originalExposedFieldValues.push(originalExposedFieldValue);
      });

      return {
        ...deepClone(initialWorkflowState),
        ...deepClone(workflowExtra),
        originalExposedFieldValues,
        mode: state.mode,
      };
    });

    builder.addCase(nodeEditorReset, (state) => {
      const mode = state.mode;
      const newState = deepClone(initialWorkflowState);
      newState.mode = mode;
      return newState;
    });

    builder.addCase(nodesChanged, (state, action) => {
      // If a node was removed, we should remove any exposed fields that were associated with it. However, node changes
      // may remove and then add the same node back. For example, when updating a workflow, we replace old nodes with
      // updated nodes. In this case, we should not remove the exposed fields. To handle this, we find the last remove
      // and add changes for each exposed field. If the remove change comes after the add change, we remove the exposed
      // field.
      const fieldsToRemove: FieldIdentifier[] = [];

      state.exposedFields.forEach((field) => {
        const removeIndex = action.payload.findLastIndex(
          (change) => change.type === 'remove' && change.id === field.nodeId
        );
        const addIndex = action.payload.findLastIndex(
          (change) => change.type === 'add' && change.item.id === field.nodeId
        );
        if (removeIndex > addIndex) {
          fieldsToRemove.push({ nodeId: field.nodeId, fieldName: field.fieldName });
        }
      });
      state.exposedFields = state.exposedFields.filter((field) => !fieldsToRemove.some((f) => isEqual(f, field)));

      for (const el of Object.values(state.form?.elements || {})) {
        if (!isNodeFieldElement(el)) {
          continue;
        }
        const { nodeId } = el.data.fieldIdentifier;
        const removeIndex = action.payload.findLastIndex((change) => change.type === 'remove' && change.id === nodeId);
        const addIndex = action.payload.findLastIndex((change) => change.type === 'add' && change.item.id === nodeId);
        if (removeIndex > addIndex) {
          removeElement({ formState: state.form, id: el.id });
        }
      }

      // Not all changes to nodes should result in the workflow being marked touched
      const filteredChanges = action.payload.filter((change) => {
        // We always want to mark the workflow as touched if a node is added, removed, or reset
        if (['add', 'remove', 'reset'].includes(change.type)) {
          return true;
        }

        // Position changes can change the position and the dragging status of the node - ignore if the change doesn't
        // affect the position
        if (change.type === 'position' && (change.position || change.positionAbsolute)) {
          return true;
        }

        // This change isn't relevant
        return false;
      });

      if (filteredChanges.length > 0 || fieldsToRemove.length > 0) {
        state.isTouched = true;
      }
    });

    builder.addMatcher(isAnyNodeOrEdgeMutation, (state) => {
      state.isTouched = true;
    });
  },
});

export const {
  workflowModeChanged,
  workflowExposedFieldAdded,
  workflowExposedFieldRemoved,
  workflowExposedFieldsReordered,
  workflowNameChanged,
  workflowCategoryChanged,
  workflowDescriptionChanged,
  workflowTagsChanged,
  workflowAuthorChanged,
  workflowNotesChanged,
  workflowVersionChanged,
  workflowContactChanged,
  workflowIDChanged,
  workflowSaved,
  workflowSearchTermChanged,
  workflowOrderByChanged,
  workflowOrderDirectionChanged,
  categorySectionsChanged,
  formReset,
  formElementAdded,
  formElementRemoved,
  formElementReparented,
  formRootReordered,
  formContainerChildrenReordered,
  formElementHeadingDataChanged,
  formElementTextDataChanged,
  formElementNodeFieldDataChanged,
  formElementContainerDataChanged,
  formModeChanged,
} = workflowSlice.actions;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const migrateWorkflowState = (state: any): any => {
  if (!('_version' in state)) {
    state._version = 1;
  }
  return state;
};

export const workflowPersistConfig: PersistConfig<WorkflowState> = {
  name: workflowSlice.name,
  initialState: initialWorkflowState,
  migrate: migrateWorkflowState,
  persistDenylist: [],
};

export const selectWorkflowSlice = (state: RootState) => state.workflow;
const createWorkflowSelector = <T>(selector: Selector<WorkflowState, T>) =>
  createSelector(selectWorkflowSlice, selector);

export const selectWorkflowName = createWorkflowSelector((workflow) => workflow.name);
export const selectWorkflowId = createWorkflowSelector((workflow) => workflow.id);
export const selectWorkflowMode = createWorkflowSelector((workflow) => workflow.mode);
export const selectWorkflowFormMode = createWorkflowSelector((workflow) => workflow.formMode);
export const selectWorkflowIsTouched = createWorkflowSelector((workflow) => workflow.isTouched);
export const selectWorkflowSearchTerm = createWorkflowSelector((workflow) => workflow.searchTerm);
export const selectWorkflowOrderBy = createWorkflowSelector((workflow) => workflow.orderBy);
export const selectWorkflowOrderDirection = createWorkflowSelector((workflow) => workflow.orderDirection);
export const selectWorkflowDescription = createWorkflowSelector((workflow) => workflow.description);

export const selectCleanEditor = createSelector([selectNodesSlice, selectWorkflowSlice], (nodes, workflow) => {
  const noNodes = !nodes.nodes.length;
  const isTouched = workflow.isTouched;
  const savedWorkflow = !!workflow.id;
  return noNodes && !isTouched && !savedWorkflow;
});

export const selectFormLayout = createWorkflowSelector((workflow) => workflow.form.layout);
export const selectFormIsEmpty = createWorkflowSelector((workflow) => workflow.form.layout.length === 0);
const buildSelectElement = (id: string) => createWorkflowSelector((workflow) => workflow.form?.elements[id]);
export const useElement = (id: string): FormElement | undefined => {
  const selector = useMemo(() => buildSelectElement(id), [id]);
  const element = useAppSelector(selector);
  return element;
};

const removeElement = (args: { formState: NonNullable<WorkflowV3['form']>; id: string }) => {
  const { id, formState } = args;

  const element = formState.elements[id];

  // Bail if the element doesn't exist
  if (!element) {
    return;
  }

  delete formState.elements[id];

  if (!element.parentId) {
    formState.layout = formState.layout.filter((elId) => elId !== id);
    return;
  }

  const parent = formState.elements[element.parentId];
  if (!parent || !isContainerElement(parent)) {
    return;
  }
  parent.data.children = parent.data.children.filter((childId) => childId !== id);
};

const reparentElement = (args: {
  formState: NonNullable<WorkflowV3['form']>;
  id: string;
  containerId?: string;
  index?: number;
}) => {
  const { formState, id, containerId, index } = args;
  const { elements } = formState;

  const element = elements[id];

  // Bail if the element doesn't exist
  if (!element) {
    return;
  }

  if (containerId === element.parentId) {
    // Nothing to do
    return;
  }

  // Reparenting from container to root
  if (containerId === undefined && element.parentId !== undefined) {
    const oldParent = elements[element.parentId];
    if (!oldParent || !isContainerElement(oldParent)) {
      // This should never happen
      return;
    }

    formState.layout.splice(index ?? formState.layout.length, 0, id);
    oldParent.data.children = oldParent.data.children.filter((elementId) => elementId !== id);
    element.parentId = containerId;
  }

  // Reparenting from one container to another container
  if (containerId !== undefined && element.parentId !== undefined) {
    const oldParent = elements[element.parentId];
    if (!oldParent || !isContainerElement(oldParent)) {
      return;
    }
    const newParent = elements[containerId];
    if (!newParent || !isContainerElement(newParent)) {
      return;
    }
    newParent.data.children.splice(index ?? newParent.data.children.length, 0, id);
    oldParent.data.children = oldParent.data.children.filter((elementId) => elementId !== id);
    element.parentId = containerId;
  }

  // Reparenting from root to container
  if (containerId !== undefined && element.parentId === undefined) {
    const newParent = elements[containerId];
    if (!newParent || !isContainerElement(newParent)) {
      return;
    }
    newParent.data.children.splice(index ?? newParent.data.children.length, 0, id);
    formState.layout = formState.layout.filter((elementId) => elementId !== id);
    element.parentId = containerId;
  }

  // We should never get here!
};

const addElement = (args: {
  formState: NonNullable<WorkflowV3['form']>;
  element: FormElement;
  containerId?: string;
  index?: number;
}) => {
  const { formState, element, containerId, index } = args;
  const { elements } = formState;

  // Adding to the root
  if (!containerId) {
    element.parentId = undefined;
    formState.elements[element.id] = element;
    formState.layout.splice(index ?? formState.layout.length, 0, element.id);
    return;
  }

  const container = elements[containerId];
  if (!container || !isContainerElement(container)) {
    return;
  }

  element.parentId = containerId;
  elements[element.id] = element;
  container.data.children.splice(index ?? container.data.children.length, 0, element.id);
};
