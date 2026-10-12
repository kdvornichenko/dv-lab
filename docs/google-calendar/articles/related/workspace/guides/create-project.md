# Create a Google Cloud project

Source: https://developers.google.com/workspace/guides/create-project

Snapshot: 2026-10-11T09:59:04.482060+00:00; Google updated: 2026-09-03.

Google documentation: CC BY 4.0; code samples: Apache 2.0. [License](<../../../../LICENSE.md>). Converted to Markdown from the preserved [HTML](<../../../../pages/related/workspace/guides/create-project.html>); no article content intentionally omitted.

---

![Spark icon](../../../../assets/5577ad69e1ca0549dbb0.svg)

<a id="key-takeaways-panel-title"></a>

## Page Summary

outlined\_flag

- A Google Cloud project is a prerequisite for utilizing Google Workspace APIs and developing Google Workspace add-ons or applications.

- You can create a new Cloud project through the Google Cloud console or the gcloud command-line interface, providing a foundation for your Google Workspace integrations.

- Depending on your usage of Google Workspace APIs, enabling billing for your Cloud project might be necessary to access certain features and services.

- After creating your Cloud project, the next crucial step is to enable the specific Google Workspace APIs that your application or add-on will interact with.

A Google Cloud project is required to use Google Workspace APIs and build Google Workspace add-ons or apps. A Cloud project forms the basis for creating, enabling, and using all Google Cloud services, including managing APIs, enabling billing, adding and removing collaborators, and managing permissions.

<a id="project"></a>

## Create a Cloud project

<a id="google-cloud-console"></a>

### Google Cloud console

- In the Google Cloud console, go to Menu menu > **IAM & Admin** > **Create a Project**.

  [Go to Create a Project](https://console.cloud.google.com/projectcreate)

- In the **Project Name** field, enter a descriptive name for your project.

  Optional: To edit the **Project ID**, click **Edit**. The project ID can't be changed after the project is created, so choose an ID that meets your needs for the lifetime of the project.

- In the **Location** field, click **Browse** to display potential locations for your project. Then, click **Select**.

  **Caution: Can't find your Google Workspace organization?**<br>
   This means you aren't signed in to a Google Workspace account. Some of the features described in Google Workspace developer documentation are only available to projects associated with an organization.

- Click **Create**. The Google Cloud console navigates to the Dashboard page and your project is created within a few minutes.

<a id="gcloud-cli"></a>

### gcloud CLI

In one of the following development environments, access the Google Cloud CLI (`gcloud`):

- **Cloud Shell**: To use an online terminal with the gcloud CLI already set up, activate Cloud Shell. <br>
   [Activate Cloud Shell](https://console.cloud.google.com/?cloudshell=true)

- **Local Shell**: To use a local development environment, [install](https://cloud.google.com/sdk/docs/install) and [initialize](https://cloud.google.com/sdk/docs/initializing) the gcloud CLI. <br>
   To create a Cloud project, use the `gcloud projects create` command:

  ```Bash Session
  gcloud projects create PROJECT_ID
  ```

   Replace PROJECT\_ID by setting the ID for the project you want to create.

For further information on Cloud projects, refer to [Creating and managing projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects) in the Google Cloud documentation.

<a id="billing"></a>

## Optional: Enable billing for your Cloud project

Depending on the Google Workspace APIs and features that you want to use, you might also need to enable billing for your Cloud project:

If you're unable to link a billing account, you don't have the permissions needed to make this change. For more information, see [Permissions required to enable billing](https://cloud.google.com/billing/docs/how-to/modify-project#required-permissions-enable).

<a id="google-cloud-console_1"></a>

### Google Cloud console

- In the Google Cloud console, go to **Billing**. Click **Menu** menu > **Billing** > **My Projects**.

  [Go to Billing for My Projects](https://console.cloud.google.com/billing/projects)

- In **Select an organization**, choose the organization associated with your Google Cloud project.

- In the project row, open the **Actions** menu (more\_vert), click **Change billing**, and choose the Cloud Billing account.

- Click **Set account**.

<a id="gcloud-cli_1"></a>

### gcloud CLI

- To list available billing accounts, run:

  ```Bash Session
  gcloud billing accounts list
  ```

- Link a billing account with a Google Cloud project:

  ```Bash Session
  gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
  ```


  Replace the following:

  - `PROJECT_ID` is the **Project ID** for the Cloud project for which you want to enable billing.

  - `BILLING_ACCOUNT_ID` is the **billing account ID** to link with the Google Cloud project.

For further information about billing, see [Enable, disable, or change billing for a project](https://cloud.google.com/billing/docs/how-to/modify-project) in the Google Cloud Billing documentation.

<a id="next-step"></a>

## Next step

[Enable Google Workspace APIs](https://developers.google.com/workspace/guides/enable-apis) in your Cloud project.
