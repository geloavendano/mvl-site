const { teams } = window.MVL_DATA;

const form = document.getElementById('waiverForm');
const teamSelect = document.getElementById('teamSelect');
const relationshipSelect = document.getElementById('relationshipSelect');
const relationshipOtherField = document.getElementById('relationshipOtherField');
const relationshipOtherInput = document.getElementById('relationshipOtherInput');
const formStatus = document.getElementById('formStatus');

teams.forEach((team) => {
  const option = document.createElement('option');
  option.value = team.id;
  option.textContent = team.name;
  teamSelect.append(option);
});

const syncRelationshipOther = () => {
  const needsOther = relationshipSelect.value === 'Other';
  relationshipOtherField.classList.toggle('is-hidden', !needsOther);
  relationshipOtherInput.required = needsOther;
  if (!needsOther) relationshipOtherInput.value = '';
};

relationshipSelect.addEventListener('change', syncRelationshipOther);
syncRelationshipOther();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  formStatus.classList.remove('is-error', 'is-success');

  if (!form.checkValidity()) {
    formStatus.textContent = 'Please complete all required fields and check the mobile number format.';
    formStatus.classList.add('is-error');
    form.reportValidity();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  data.submitted_at = new Date().toISOString();
  data.source = 'static-preview';

  // TODO: send this payload to Supabase once the backend endpoint is enabled.
  console.info('MVL waiver payload preview:', data);

  formStatus.textContent = 'Form looks complete. Backend submission is not connected yet.';
  formStatus.classList.add('is-success');
});
