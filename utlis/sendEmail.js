// This file contains the code to send an email using nodemailer
const nodemailer = require('nodemailer')

const sendEmail = async ({ to, subject, text }) => {
  // Create a transporter object with your email service configuration
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // Example: using gmail as the email service
    port: 2525,
    auth: {
      user: process.env.EMAIL_USERNAME, // Your email address
      pass: process.env.EMAIL_PASSWORD, // Your email password
    },
  })

  // Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM, // Sender address
    to: to,                           // Receiver's email
    subject: subject,                      // Subject of the email
    text: text,                         // Plain text body of the email
  }

  // Send the email
  await transporter.sendMail(mailOptions)
}

module.exports = sendEmail
