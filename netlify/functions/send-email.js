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

  // Check environment variables
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Missing email configuration:', {
      hasUser: !!process.env.GMAIL_USER,
      hasPassword: !!process.env.GMAIL_APP_PASSWORD
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Email service not configured. Contact admin.' })
    };
  }

  try {
    const bodySize = event.body ? event.body.length : 0;
    console.log('Request body size:', Math.round(bodySize / 1024), 'KB');

    const { to, subject, html, pdfBase64, pdfFilename } = JSON.parse(event.body);

    if (pdfBase64) {
      console.log('PDF attachment size:', Math.round(pdfBase64.length / 1024), 'KB');
    }

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

    console.log('Creating transporter with user:', process.env.GMAIL_USER);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Eastern Quality" <${process.env.GMAIL_USER}>`,
      to: recipients.join(', '),
      subject: subject,
      html: html,
      attachments: pdfBase64 ? [{
        filename: pdfFilename || 'report.pdf',
        content: pdfBase64,
        encoding: 'base64'
      }] : []
    };

    // Verify SMTP connection first
    console.log('Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('SMTP connection verified');
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError.message);
      throw new Error(`SMTP auth failed: ${verifyError.message}`);
    }

    console.log('Sending email to:', recipients.join(', '));
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Email sent to ${recipients.length} recipient(s)` })
    };
  } catch (error) {
    console.error('Email error:', error.message);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: `Email failed: ${error.message}` })
    };
  }
};
