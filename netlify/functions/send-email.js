const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  try {
    const { to, subject, html, pdfBase64, pdfFilename } = JSON.parse(event.body);

    // Validate recipients
    const recipients = Array.isArray(to) ? to.filter(email => email && email.trim()) : (to ? [to] : []);

    if (recipients.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'No valid email recipients provided. Configure recipients in Settings.' })
      };
    }

    if (!subject) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Email subject is required' })
      };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: '"Eastern Mills QC" <automations@easternmills.com>',
      to: recipients.join(', '),
      subject: subject,
      html: html,
      attachments: pdfBase64 ? [{
        filename: pdfFilename || 'report.pdf',
        content: pdfBase64,
        encoding: 'base64'
      }] : []
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Email sent to ${recipients.length} recipient(s)` })
    };
  } catch (error) {
    console.error('Email error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
