const Query = require('../models/Query');
const User = require('../models/User');
const { BadRequestError, NotFoundError } = require('../errors/index');
const {StatusCodes} = require('http-status-codes')

const getAllQueries = async (req, res, next) => { 
    try {
        const queries = await Query.find({ }).sort('createdAt')
        res.status(StatusCodes.OK).json({ queries, count: queries.length })
    } catch (error) {
        next(error)
    }
}

const filterQueries = async (req, res, next) => { 
    try {
        const queries = await Query.find(req.body).sort('createdAt')
        res.status(StatusCodes.OK).json({ queries })
    } catch (error) {
        next(error)
    }
}

const getQuery = async (req, res, next) => { 
    const { id: queryId } = req.params
    try {
        const query = await Query.findOne({ _id: queryId })
        if (!query) {
            throw new NotFoundError(`No query with id : ${queryId}`)
        }
        res.status(StatusCodes.OK).json({ query })
    }
    catch (error) {
        next(error)
    }
}

const createQuery = async (req, res, next) => { 
    const { userId, query } = req.body
    try {
        const user = await User.findOne({ _id: userId })
        if (!user) {
            throw new NotFoundError(`No user with id : ${userId}`)
        }
        const newQuery = await Query.create({ userId, query })
        res.status(StatusCodes.CREATED).json({ newQuery })
    } catch (error) {
        next(error)
    }
}

const updateQuery = async (req, res, next) => {
    const { id: queryId } = req.params;
    const { response: adminResponse, status } = req.body;
  
    try {
      const newResponse = {
        response: adminResponse,
        timestamp: Date.now(),
      };
  
      const updatedQuery = await Query.findOneAndUpdate(
        { _id: queryId },
        { 
          $push: { response: newResponse }, // Push new response to response array
          status: status || 'in-progress', 
        },
        { new: true, runValidators: true }
      );
  
      if (!updatedQuery) {
        throw new NotFoundError(`No query with id: ${queryId}`);
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
            { status: 'closed', resolvedAt: Date.now() },
            { new: true, runValidators: true }
        );
        if (!updatedQuery) {
            throw new BadRequestError(`No query with id: ${queryId}`);
        }
        res.status(StatusCodes.OK).json({ updatedQuery });
    }
    catch (error) {
        next(error)
    }
}
            

module.exports = {
    getAllQueries,
    filterQueries,
    getQuery,
    createQuery,
    updateQuery,
    closeQuery
}