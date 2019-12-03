# Job Tracking

A Google Cloud Function that fetches certain companies jobs and store them in Google Cloud Firestore. 

## Installation

```bash
npm install
```

## Deply to Google Cloud

```bash
gcloud functions deploy getJobs --runtime nodejs10 --trigger-http --timeout=9
