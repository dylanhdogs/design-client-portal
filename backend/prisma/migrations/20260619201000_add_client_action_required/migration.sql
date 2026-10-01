ALTER TABLE "checklist_items" ADD COLUMN "client_action_required" BOOLEAN NOT NULL DEFAULT false;

UPDATE "checklist_items"
SET "client_action_required" = true
WHERE "description" IN (
  'Determine primary use (recreation / fitness / aesthetic)',
  'Establish budget range',
  'Complete client lifestyle interview',
  'Select features (spa, tanning ledge, waterfall, lighting, heating)',
  'Choose finishes (plaster, pebble, glass tile)',
  'Select decking and coping materials',
  'Finalize design revisions',
  'Review and revise based on client feedback',
  'Sign contract and collect deposit',
  'Conduct final walkthrough with client',
  'Confirm dimensions, equipment placement, scale markings'
);
