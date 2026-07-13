const { teams } = window.MVL_DATA;

const form = document.getElementById('waiverForm');
const teamSelect = document.getElementById('teamSelect');
const relationshipSelect = document.getElementById('relationshipSelect');
const relationshipOtherField = document.getElementById('relationshipOtherField');
const relationshipOtherInput = document.getElementById('relationshipOtherInput');
const formStatus = document.getElementById('formStatus');
const supabase = window.MVL_SUPABASE;

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

const submitWaiver = async (payload) => {
  if (!supabase?.url || !supabase?.anonKey) {
    throw new Error('Supabase is not configured.');
  }

  const response = await fetch(`${supabase.url}/rest/v1/rpc/mvl_submit_waiver`, {
    method: 'POST',
    headers: {
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Unable to submit waiver.';
    try {
      const error = await response.json();
      message = error.message || error.details || message;
    } catch (_) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus.classList.remove('is-error', 'is-success');

  if (!form.checkValidity()) {
    formStatus.textContent = 'Please complete all required fields and check the mobile number format.';
    formStatus.classList.add('is-error');
    form.reportValidity();
    return;
  }

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    p_team_id: formData.team_id,
    p_first_name: formData.first_name.trim(),
    p_last_name: formData.last_name.trim(),
    p_contact_number: formData.contact_number.trim(),
    p_email: formData.email.trim(),
    p_emergency_contact_name: formData.emergency_contact_name.trim(),
    p_emergency_contact_number: formData.emergency_contact_number.trim(),
    p_relationship: formData.relationship,
    p_relationship_other: formData.relationship === 'Other' ? formData.relationship_other.trim() : null,
    p_waiver_acknowledged: formData.waiver_acknowledged === 'on',
    p_submitted_at: new Date().toISOString(),
    p_user_agent: navigator.userAgent,
  };

  form.querySelector('button[type="submit"]').disabled = true;
  formStatus.textContent = 'Submitting waiver...';

  try {
    await submitWaiver(payload);
    window.location.assign('waiver-confirmation.html');
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.classList.add('is-error');
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
});
