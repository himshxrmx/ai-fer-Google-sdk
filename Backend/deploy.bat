@echo off
echo =======================================================
echo Deploying Backend to Google Cloud Run
echo =======================================================

echo Make sure you have installed Google Cloud CLI and run:
echo gcloud auth login
echo.
set /p GCP_PROJECT="Enter your GCP Project ID (e.g., emotion-analytics-412213): "

if "%GCP_PROJECT%"=="" (
    echo Project ID cannot be empty.
    pause
    exit /b
)

echo Setting GCP Project...
gcloud config set project %GCP_PROJECT%

echo Enabling necessary APIs...
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

echo Initializing Firestore (Native mode)...
gcloud firestore databases create --location=us-east1 --type=firestore-native

set /p GEMINI_KEY="Enter your Gemini API Key: "
if "%GEMINI_KEY%"=="" (
    echo Gemini API Key cannot be empty.
    pause
    exit /b
)

echo Storing Secret in Secret Manager...
echo %GEMINI_KEY% | gcloud secrets create gemini-api-key --data-file=-
gcloud secrets versions add gemini-api-key --data-file=-

echo.
echo =======================================================
echo Building and Deploying to Cloud Run
echo =======================================================

gcloud run deploy emotion-analytics-api ^
    --source . ^
    --region us-east1 ^
    --allow-unauthenticated ^
    --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" ^
    --set-env-vars="GOOGLE_CLOUD_PROJECT=%GCP_PROJECT%" ^
    --min-instances 0 ^
    --max-instances 100 ^
    --concurrency 80 ^
    --memory 1Gi ^
    --cpu 1000m

echo =======================================================
echo DEPLOYMENT COMPLETE!
echo Reminder: Update your API_BASE in Frontend/script.js and Frontend/dashboard.js
echo with the URL provided above.
echo =======================================================
pause
