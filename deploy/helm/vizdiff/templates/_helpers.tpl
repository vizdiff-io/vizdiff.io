{{/*
Expand the name of the chart.
*/}}
{{- define "vizdiff.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "vizdiff.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "vizdiff.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vizdiff.labels" -}}
helm.sh/chart: {{ include "vizdiff.chart" . }}
{{ include "vizdiff.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels (release-wide)
*/}}
{{- define "vizdiff.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vizdiff.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Per-component labels. Call with a dict: (dict "ctx" . "component" "api")
*/}}
{{- define "vizdiff.componentLabels" -}}
{{ include "vizdiff.labels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "vizdiff.componentSelectorLabels" -}}
{{ include "vizdiff.selectorLabels" .ctx }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
ServiceAccount name to use.
*/}}
{{- define "vizdiff.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vizdiff.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve an image reference for a service.
Call with (dict "ctx" . "svc" "api").
*/}}
{{- define "vizdiff.image" -}}
{{- $ctx := .ctx -}}
{{- $svc := index $ctx.Values.image .svc -}}
{{- $registry := $ctx.Values.image.registry -}}
{{- $repo := $svc.repository -}}
{{- $tag := $svc.tag | default $ctx.Values.image.tag | default $ctx.Chart.AppVersion -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end }}

{{/*
Effective Postgres host. Points at the embedded Postgres Service when enabled.
*/}}
{{- define "vizdiff.postgresHost" -}}
{{- if .Values.postgres.embedded -}}
{{- printf "%s-postgres" (include "vizdiff.fullname" .) -}}
{{- else -}}
{{- required "postgres.host is required when postgres.embedded is false" .Values.postgres.host -}}
{{- end -}}
{{- end }}

{{/*
Effective S3 endpoint. Points at the embedded MinIO Service when enabled.
*/}}
{{- define "vizdiff.s3Endpoint" -}}
{{- if .Values.s3.minio.enabled -}}
{{- printf "http://%s-minio:9000" (include "vizdiff.fullname" .) -}}
{{- else -}}
{{- .Values.s3.endpoint -}}
{{- end -}}
{{- end }}

{{/*
Name of the Secret consumed via envFrom (chart-managed or external).
*/}}
{{- define "vizdiff.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "vizdiff.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
Ingress host, defaulting to the host parsed out of appUrl.
*/}}
{{- define "vizdiff.ingressHost" -}}
{{- if .Values.ingress.host -}}
{{- .Values.ingress.host -}}
{{- else -}}
{{- $u := .Values.appUrl | default "https://vizdiff.example.com" -}}
{{- $noScheme := regexReplaceAll "^https?://" $u "" -}}
{{- regexReplaceAll "/.*$" $noScheme "" -}}
{{- end -}}
{{- end }}
