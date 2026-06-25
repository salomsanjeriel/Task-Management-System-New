import nodemailer from 'nodemailer';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generic email sender with automatic retry logic.
 * If credentials are not set, it logs the mock message structure.
 * 
 * @param {object} mailOptions Standard nodemailer options
 * @param {number} retries Maximum retry attempts
 * @param {number} delay Delay between retries in milliseconds
 */
async function sendEmailWithRetry(mailOptions, retries = 3, delay = 1000) {
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!hasSmtpConfig) {
    console.log('\n================== [MOCK EMAIL] ==================');
    console.log(`FROM: ${mailOptions.from || process.env.SMTP_FROM || 'no-reply@taskflow.com'}`);
    console.log(`TO: ${mailOptions.to}`);
    console.log(`SUBJECT: ${mailOptions.subject}`);
    console.log('---------------------------------------------------------');
    console.log(mailOptions.text);
    console.log('==========================================================\n');
    console.log('NOTE: Real email was not sent because SMTP credentials (.env) were not loaded.');
    return { mock: true, recipient: mailOptions.to };
  }
  
  console.log(`[EMAIL DISPATCH] Preparing to send real email to: ${mailOptions.to} using ${process.env.SMTP_USER}`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  for (let i = 0; i < retries; i++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Email send attempt ${i + 1} failed. Retrying in ${delay}ms... Error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * HTML Styling helper for standard premium card layout
 */
function getTemplateWrapper(title, contentHtml, buttonHtml = '') {
  return `
    <div style="font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
      <div style="text-align: left; margin-bottom: 24px;">
        <span style="font-size: 22px; font-weight: 800; color: #7c3aed; letter-spacing: -0.5px;">⚡ TaskFlow</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">${title}</h2>
      <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-top: 16px;">
        ${contentHtml}
      </div>
      ${buttonHtml}
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0 16px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
        This email was sent by TaskFlow because you are a registered collaborator.<br/>
        Please do not reply directly to this automated address.
      </p>
    </div>
  `;
}

/**
 * A. Send Task Assignment Email
 */
export async function sendTaskAssignmentEmail({ email, name, taskTitle, taskDescription, projectName, dueDate, priority, taskId }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"TaskFlow Team" <no-reply@taskflow.com>',
    to: email,
    subject: `New Task Assigned: ${taskTitle}`,
    text: `Hi ${name},\n\nYou have been assigned a new task: "${taskTitle}" in Project "${projectName}".\nDue Date: ${dueDate}\nPriority: ${priority}\nDescription: ${taskDescription || 'No description provided.'}\n\nView Task: ${frontendUrl}/tasks/edit/${taskId}`,
    html: getTemplateWrapper(
      'New Task Assignment',
      `
        <p>Hi <strong>${name}</strong>,</p>
        <p>You have been assigned to a new task inside the project <strong>"${projectName}"</strong>.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">${taskTitle}</h3>
          <p style="margin: 0 0 12px 0; color: #475569; font-size: 14px;">${taskDescription || '<em>No description provided.</em>'}</p>
          
          <table style="width: 100%; font-size: 13px; color: #64748b;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Priority:</td>
              <td style="padding: 4px 0;"><span style="background-color: #f1f5f9; padding: 2px 8px; border-radius: 4px; color: #0f172a; font-weight: bold; font-size: 11px;">${priority.toUpperCase()}</span></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Due Date:</td>
              <td style="padding: 4px 0; color: #e11d48; font-weight: 600;">${dueDate}</td>
            </tr>
          </table>
        </div>
      `,
      `
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${frontendUrl}/tasks/edit/${taskId}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(124,58,237,0.25);">
            View Task details
          </a>
        </div>
      `
    ),
  };

  return await sendEmailWithRetry(mailOptions);
}

/**
 * B. Send Task Status Change Email
 */
export async function sendTaskStatusChangeEmail({ email, name, taskTitle, oldStatus, newStatus, changedBy, taskId }) {
  const formatStatus = (s) => s.replace('_', ' ').toUpperCase();

  const mailOptions = {
    from: process.env.SMTP_FROM || '"TaskFlow Team" <no-reply@taskflow.com>',
    to: email,
    subject: `Task Status Updated: ${taskTitle}`,
    text: `Hi ${name},\n\n"${taskTitle}" was updated from "${formatStatus(oldStatus)}" to "${formatStatus(newStatus)}" by ${changedBy}.\n\nView Task: ${frontendUrl}/tasks/edit/${taskId}`,
    html: getTemplateWrapper(
      'Task Status Updated',
      `
        <p>Hi <strong>${name}</strong>,</p>
        <p>The status of task <strong>"${taskTitle}"</strong> has been updated by <strong>${changedBy}</strong>.</p>
        
        <div style="text-align: center; background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px dashed #cbd5e1;">
          <span style="display: inline-block; background-color: #e2e8f0; color: #475569; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700;">${formatStatus(oldStatus)}</span>
          <span style="margin: 0 16px; font-size: 18px; color: #94a3b8; font-weight: bold;">➔</span>
          <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700;">${formatStatus(newStatus)}</span>
        </div>
      `,
      `
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${frontendUrl}/tasks/edit/${taskId}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(124,58,237,0.25);">
            View Updated Task
          </a>
        </div>
      `
    ),
  };

  return await sendEmailWithRetry(mailOptions);
}

/**
 * C. Send Task Deadline Approaching Email
 */
export async function sendDeadlineReminderEmail({ email, name, taskTitle, daysRemaining, priority, taskId }) {
  const urgencyLabel = daysRemaining <= 1 ? 'URGENT' : 'IMPORTANT';
  const color = daysRemaining <= 1 ? '#e11d48' : '#d97706';

  const mailOptions = {
    from: process.env.SMTP_FROM || '"TaskFlow Team" <no-reply@taskflow.com>',
    to: email,
    subject: `Task Deadline Approaching: ${taskTitle}`,
    text: `Hi ${name},\n\nThis is a reminder that the deadline for "${taskTitle}" is approaching.\nTime Remaining: ${daysRemaining} days.\nPriority: ${priority}\n\nView Task: ${frontendUrl}/tasks/edit/${taskId}`,
    html: getTemplateWrapper(
      'Deadline Approaching',
      `
        <p>Hi <strong>${name}</strong>,</p>
        <p>This is an automated reminder that the deadline for task <strong>"${taskTitle}"</strong> is approaching quickly.</p>
        
        <div style="background-color: #fff1f2; border: 1px solid #ffe4e6; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 5px solid ${color};">
          <table style="width: 100%;">
            <tr>
              <td style="font-size: 14px; font-weight: bold; color: #9f1239;">Remaining Time:</td>
              <td style="font-size: 15px; font-weight: 800; color: ${color}; text-align: right;">${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #475569; padding-top: 4px;">Urgency Level:</td>
              <td style="font-size: 12px; font-weight: 700; color: #475569; text-align: right; padding-top: 4px;">${urgencyLabel}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #475569; padding-top: 4px;">Task Priority:</td>
              <td style="font-size: 12px; font-weight: 700; color: #475569; text-align: right; padding-top: 4px;">${priority.toUpperCase()}</td>
            </tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 13px;">Please complete the task or coordinate with your project manager if you require a deadline extension.</p>
      `,
      `
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${frontendUrl}/tasks/edit/${taskId}" style="display: inline-block; background-color: ${color}; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(225,29,72,0.25);">
            View Task Details
          </a>
        </div>
      `
    ),
  };

  return await sendEmailWithRetry(mailOptions);
}

/**
 * D. Send Project Assignment Email
 */
export async function sendProjectAssignmentEmail({ email, name, projectName, projectDescription, role, timeline, projectId }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"TaskFlow Team" <no-reply@taskflow.com>',
    to: email,
    subject: `You've been added to a new project: ${projectName}`,
    text: `Hi ${name},\n\nYou have been assigned to Project "${projectName}" as "${role}".\nTimeline/Created: ${timeline}\nDescription: ${projectDescription || 'No description'}\n\nView Project: ${frontendUrl}/projects`,
    html: getTemplateWrapper(
      'New Project Assignment',
      `
        <p>Hi <strong>${name}</strong>,</p>
        <p>You have been assigned to a new project on TaskFlow.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 18px; border-radius: 12px; margin: 20px 0;">
          <h3 style="margin: 0 0 6px 0; color: #14532d; font-size: 16px;">📁 ${projectName}</h3>
          <p style="margin: 0 0 14px 0; color: #166534; font-size: 14px;">${projectDescription || '<em>No description provided.</em>'}</p>
          
          <table style="width: 100%; font-size: 13px; color: #14532d;">
            <tr>
              <td style="font-weight: 600;">Your Role:</td>
              <td style="text-align: right; font-weight: 700;">${role.replace('_', ' ').toUpperCase()}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; padding-top: 4px;">Assigned Date:</td>
              <td style="text-align: right; padding-top: 4px;">${timeline}</td>
            </tr>
          </table>
        </div>
      `,
      `
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${frontendUrl}/projects" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(22,163,74,0.25);">
            View Project List
          </a>
        </div>
      `
    ),
  };

  return await sendEmailWithRetry(mailOptions);
}

/**
 * E. Send Comment Notification Email
 */
export async function sendCommentNotificationEmail({ email, name, taskTitle, commenterName, commentContent, taskId }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"TaskFlow Team" <no-reply@taskflow.com>',
    to: email,
    subject: `New comment on: ${taskTitle}`,
    text: `Hi ${name},\n\n${commenterName} left a comment on "${taskTitle}":\n"${commentContent}"\n\nView Task: ${frontendUrl}/tasks/edit/${taskId}`,
    html: getTemplateWrapper(
      'New Task Comment',
      `
        <p>Hi <strong>${name}</strong>,</p>
        <p><strong>${commenterName}</strong> left a new comment on task <strong>"${taskTitle}"</strong>:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin: 20px 0; position: relative;">
          <span style="font-size: 13px; font-weight: 700; color: #475569; display: block; margin-bottom: 6px;">💬 ${commenterName}</span>
          <p style="margin: 0; color: #0f172a; font-size: 14px; font-style: italic; line-height: 1.5;">
            "${commentContent}"
          </p>
        </div>
      `,
      `
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${frontendUrl}/tasks/edit/${taskId}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(124,58,237,0.25);">
            Reply to Comment
          </a>
        </div>
      `
    ),
  };

  return await sendEmailWithRetry(mailOptions);
}

/**
 * Original welcome email structure, updated to use sendEmailWithRetry
 */
export async function sendWelcomeEmail(email, name, tempPassword) {
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Taskflow Team" <no-reply@taskflow.com>',
    to: email,
    subject: 'Welcome to Taskflow - Your Temporary Credentials',
    text: `Hi ${name},\n\nYour administrator has created an account for you on Taskflow.\n\nYour credentials are:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nYou must reset this password upon your first login.\n\nLogin: ${frontendUrl}/login`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #7c3aed; margin-top: 0;">Welcome to Taskflow, ${name}!</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Your administrator has created an account for you on the Task Management System.</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Use the following temporary credentials to log in:</p>
        <div style="background-color: #f8fafc; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 15px; color: #1e293b;"><strong>Username / Email:</strong> ${email}</p>
          <p style="margin: 4px 0; font-size: 15px; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">${tempPassword}</code></p>
        </div>
        <p style="color: #ef4444; font-size: 14px; font-weight: 600; margin-top: 16px;">Important: You must reset your password upon logging in for the first time.</p>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${frontendUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.4);">
            Log In Now
          </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0 24px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">This is an automated system email. Please do not reply directly.</p>
      </div>
    `,
  };

  return await sendEmailWithRetry(mailOptions);
}
