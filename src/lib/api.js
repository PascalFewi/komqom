async function workerRequest(path, token, method = 'GET') {
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Worker error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function getSegmentDetail(token, id) {
  return workerRequest(`/api/segments/${id}`, token);
}

export function refreshSegment(token, id) {
  return workerRequest(`/api/segments/${id}/refresh`, token, 'POST');
}
