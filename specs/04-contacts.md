# Spec: Contacts

**Intent:** `search_contacts`, `add_contact_form`, `sort_contacts`  
**Route:** `contacts.html`

## Preconditions

- Authenticated session.

## Flows

1. Wait for app ready (`#global-loader-overlay` inactive).
2. **Search:** type a substring into `#contact-search`; list `#contact-list` filters (or stays stable if no matches).
3. **Sort:** click `#sort-first-last-btn` and `#sort-last-first-btn`; list order may change.
4. **Add contact:** click `#add-contact-btn` (plus). Fill `#contact-first-name`, `#contact-last-name` at minimum; save via form submit if the spec requires persistence (optional for smoke: only verify form `#contact-form` and inputs visible).
5. **Details panel:** `#contact-details` and `#contact-form` visible when a contact is selected or after add.

## Success criteria

- Search input accepts input; picker `#contact-list` is present.
- Add flow exposes required fields without console errors.

## Primary selectors

`#contact-search`, `#contact-list`, `#add-contact-btn`, `#contact-form`, `#contact-first-name`, `#contact-last-name`, `#sort-first-last-btn`, `#sort-last-first-btn`, `#contact-details`

## Caution

- `#delete-contact-btn` is destructive; omit from default smoke unless using a disposable test contact.
