const Query = require("../models/Query");
const User = require("../models/User");
const Job = require('../models/Job.js')
const { BadRequestError, NotFoundError } = require("../errors/index");
const { StatusCodes } = require("http-status-codes");
const sendEmail = require("../utlis/sendEmail.js");

const getAllQueries = async (req, res, next) => {
  try {
    const queries = await Query.find({}).sort("createdAt");

    const queriesPromises = queries.map(async (query) => {
      const id = query.userId
      const user = await User.findById({ _id: id });
      let reason = null;
      if (user.userRole === 'shoveller') { 
        reason = user.reason;
      }
      const job = await Job.findById({ _id: query.jobId });
      return {
        query,
        role: user.userRole,
        name: user.userName,
        email: user.email,
        applyJobCancel: job.isJobCancel,
        reason: reason
      }
    });

    // Step 3: Wait for all the promises to resolve
    const allQueries = await Promise.all(queriesPromises);

    res.status(StatusCodes.OK).json({ allQueries, count: allQueries.length });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const filterQueries = async (req, res, next) => {
  try {
    const queries = await Query.find(req.body).sort("createdAt");
    res.status(StatusCodes.OK).json({ queries });
  } catch (error) {
    next(error);
  }
};

const getQuery = async (req, res, next) => {
  const { id: queryId } = req.params;
  try {
    const query = await Query.findOne({ _id: queryId });
    if (!query) {
      throw new NotFoundError(`No query with id : ${queryId}`);
    }
    res.status(StatusCodes.OK).json({ query });
  } catch (error) {
    next(error);
  }
};

const createQuery = async (req, res, next) => {
  const { userId, jobId, title, query } = req.body;
  try {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      throw new NotFoundError(`No user with id : ${userId}`);
    }
    const newQuery = await Query.create({ userId, jobId, title, query });
    res.status(StatusCodes.CREATED).json({ newQuery });
  } catch (error) {
    next(error);
  }
};

const updateQuery = async (req, res, next) => {
  const { id: queryId } = req.params;
  const { response: adminResponse } = req.body;

  try {
    const updatedQuery = await Query.findOneAndUpdate(
      { _id: queryId },
      {
        $push: { response: adminResponse }, // Push new response to response array
        status: "closed",
      },
      { new: true, runValidators: true }
    );

    if (!updatedQuery) {
      throw new NotFoundError(`No query with id: ${queryId}`);
    }

    const user = await User.findOne({ _id: updatedQuery.userId });
    if (!user) {
      throw new NotFoundError(`No user with id: ${updatedQuery.userId}`);
    }

    try {
      await sendEmail({
        to: user.email,
        subject: `${updatedQuery.title} - Query Response`,
        html: adminResponse, // Send HTML content here
      });
      console.log("Email sent to user");
    } catch (error) {
      throw new BadRequestError(error.message);
    }

    res.status(StatusCodes.OK).json({ updatedQuery });
  } catch (error) {
    next(error);
  }
};

const closeQuery = async (req, res, next) => {
  const { id: queryId } = req.params;

  try {
    const updatedQuery = await Query.findOneAndUpdate(
      { _id: queryId },
      { status: "closed", resolvedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updatedQuery) {
      throw new BadRequestError(`No query with id: ${queryId}`);
    }
    res.status(StatusCodes.OK).json({ updatedQuery });
  } catch (error) {
    next(error);
  }
};

const deleteQuery = async (req, res, next) => {
  const { id: queryId } = req.params;
  try {
    const query = await Query.findOneAndDelete({ _id: queryId });
    if (!query) {
      throw new NotFoundError(`No query with id: ${queryId}`);
    }
    res.status(StatusCodes.OK).json({ query });
  }
  catch (error) {
    next(error);
  }
}

module.exports = {
  getAllQueries,
  filterQueries,
  getQuery,
  createQuery,
  updateQuery,
  closeQuery,
  deleteQuery
};
