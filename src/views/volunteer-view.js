/** Volunteer view (#volunteer): tonight's routes, open slots and my boarding passes. */

export function renderVolunteerView(container) {
  const page = container.ownerDocument;
  const heading = page.createElement('h2');
  heading.textContent = 'Volunteer';
  const note = page.createElement('p');
  note.textContent =
    "Tonight's conditions, open dawn slots and your boarding passes will appear here.";
  container.replaceChildren(heading, note);
}
