# Reusable Form Modal

Use `FormModal.tsx` whenever an application button should open a submission form over a dimmed background.

```tsx
import FormModal from '../components/FormModal';

<FormModal
  open={showForm}
  title="Edit record"
  description="Update the information below."
  busy={saving}
  submitLabel="Save changes"
  onClose={() => setShowForm(false)}
  onSubmit={saveRecord}
>
  {/* Form fields or grouped form sections */}
</FormModal>
```

The component includes:

- Dimmed black backdrop
- Responsive, scrollable dialog
- Sticky title and action areas
- Escape-key and backdrop closing
- Accessible dialog labels
- Disabled closing and submission while saving
- Configurable labels and maximum width

For a read-only detail window with actions inside it, set `showSubmit={false}` and use `cancelLabel="Close"`. The modal will omit the form submission wrapper and display one Close action.

Keep record-specific fields and save logic in the page that uses the modal. The shared component should remain focused on presentation, accessibility, and submission behavior.
